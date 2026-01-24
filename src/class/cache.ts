import { PRUNE_INTERVAL }   from '@/const.js'
import { is_event_expired } from '@/lib/event.js'

import {
  get_event_cache_key,
  match_filter,
  process_filters
} from '@/lib/filter.js'

import type {
  EventFilter,
  SignedEvent
} from '@/types/index.js'

/**
 * O(1) key-based deduplication cache with FIFO eviction.
 * Uses a Set with FIFO eviction when the limit is reached.
 */
export class KeyCache {
  private readonly _cache : Set<string> = new Set()
  private readonly _limit : number

  /**
   * Creates a new key cache.
   * @param limit  Maximum number of keys to store
   * @throws Error If limit is not a positive finite number
   */
  constructor (limit: number) {
    // If the limit is invalid,
    if (limit <= 0 || !Number.isFinite(limit)) {
      // Throw an error.
      throw new Error(`invalid cache limit: ${limit}`)
    }
    // Initialize the cache limit.
    this._limit = limit
  }

  private _next () : string | undefined {
    // Get the oldest hash.
    return this._cache.values().next().value
  }

  /**
   * Adds a key to the cache, evicting the oldest if at capacity.
   * @param key  The key to add
   */
  public add (key : string) : void {
    // If the cache is at limit, evict before adding.
    if (this._cache.size >= this._limit) {
      // Get the oldest hash.
      const head = this._next()
      // If the oldest hash is defined, remove it.
      if (head) this._cache.delete(head)
    }
    // Add the hash to the cache.
    this._cache.add(key)
  }

  /** Clears all keys from the cache. */
  public clear () : void {
    // Clear the cache.
    this._cache.clear()
  }

  /**
   * Checks if a key exists in the cache.
   * @param key  The key to check
   * @returns    True if the key is in the cache
   */
  public has (key : string) : boolean {
    // Check if the hash is in the cache.
    return this._cache.has(key)
  }
}

/**
 * Event cache with automatic expiration pruning and secondary indexes.
 * Stores events keyed by their cache key (varies by event kind).
 * Periodically removes expired events based on expiration tags.
 * Maintains kind and pubkey indexes for O(1) lookups on common filter fields.
 */
export class EventCache {
  private readonly _cache     : Map<string, SignedEvent>
  private readonly _by_kind   : Map<number, Set<string>>
  private readonly _by_pubkey : Map<string, Set<string>>
  private readonly _ival      : number

  private _timer : NodeJS.Timeout | undefined

  /**
   * Creates a new event cache.
   * @param prune_ival  Interval in seconds between pruning cycles (default: PRUNE_INTERVAL)
   */
  constructor (prune_ival : number = PRUNE_INTERVAL) {
    this._cache     = new Map()
    this._by_kind   = new Map()
    this._by_pubkey = new Map()
    this._ival      = prune_ival * 1000
    // Start the cache pruning.
    this._start()
  }

  private _start () : void {
    // Clear the existing timer if it exists.
    clearInterval(this._timer)
    // Set a new timer to prune the cache.
    this._timer = setInterval(() => this.prune(), this._ival)
    // Prevent timer from blocking process exit in Node.js.
    if (typeof this._timer.unref === 'function') this._timer.unref()
  }

  /** The underlying Map of cache keys to events. */
  public get cache () {
    return this._cache
  }

  /** Array of all cached events. */
  public get events () {
    return Array.from(this._cache.values())
  }

  /**
   * Adds an event to the cache and updates secondary indexes.
   * @param event  The signed event to cache
   */
  public add (event : SignedEvent) {
    // Get the cache key for the event.
    const key = get_event_cache_key(event)
    // If the key is not found, return.
    if (!key) return
    // Cache the event.
    this._cache.set(key, event)
    // Update the kind index.
    if (!this._by_kind.has(event.kind)) {
      this._by_kind.set(event.kind, new Set())
    }
    this._by_kind.get(event.kind)?.add(key)
    // Update the pubkey index.
    if (!this._by_pubkey.has(event.pubkey)) {
      this._by_pubkey.set(event.pubkey, new Set())
    }
    this._by_pubkey.get(event.pubkey)?.add(key)
  }

  /** Clears all events from the cache and secondary indexes. */
  public clear () {
    // Clear the cache and indexes.
    this._cache.clear()
    this._by_kind.clear()
    this._by_pubkey.clear()
  }

  /**
   * Removes an event from the cache and secondary indexes.
   * @param event  The event to remove
   */
  public delete (event : SignedEvent) {
    // Get the cache key for the event.
    const key = get_event_cache_key(event)
    // If the key is not found, return.
    if (!key) return
    // Remove from kind index.
    this._by_kind.get(event.kind)?.delete(key)
    // Remove from pubkey index.
    this._by_pubkey.get(event.pubkey)?.delete(key)
    // Delete the event from the cache.
    this._cache.delete(key)
  }

  /**
   * Returns events matching the given filters.
   * Uses secondary indexes for optimized lookups on simple kind/pubkey queries.
   * Falls back to full scan for complex queries.
   * @param filters  Event filters to match against
   * @returns        Array of matching events
   */
  public filter (filters : EventFilter[]) : SignedEvent[] {
    const results : SignedEvent[] = []
    for (const filter of filters) {
      // Check if this is a simple indexed query (only kinds or authors, no other criteria).
      const candidates = this._get_indexed_candidates(filter)
      if (candidates !== null) {
        // Use indexed candidates for faster matching.
        for (const event of candidates) {
          if (match_filter(event, filter)) {
            results.push(event)
            if (filter.limit && results.length >= filter.limit) break
          }
        }
      } else {
        // Fall back to full scan for complex queries.
        results.push(...process_filters(this.events, [ filter ]))
      }
    }
    return results
  }

  /**
   * Returns candidate events from indexes if the filter can use them.
   * Returns null if no index can be used (requires full scan).
   */
  private _get_indexed_candidates (filter : EventFilter) : SignedEvent[] | null {
    const { kinds, authors, ids, ...rest } = filter
    // Check for tag filters or other criteria that require full scan.
    const has_tag_filters = Object.keys(rest).some(k => k.startsWith('#'))
    // If filter has tag filters, we can't use indexes alone.
    if (has_tag_filters) return null
    // If filter has specific IDs, use those directly from cache.
    if (ids && ids.length > 0) {
      const events : SignedEvent[] = []
      for (const id of ids) {
        const event = this._cache.get(id)
        if (event) events.push(event)
      }
      return events
    }
    // Try to use kind index.
    if (kinds && kinds.length > 0 && (!authors || authors.length === 0)) {
      const events : SignedEvent[] = []
      for (const kind of kinds) {
        const keys = this._by_kind.get(kind)
        if (keys) {
          for (const key of keys) {
            const event = this._cache.get(key)
            if (event) events.push(event)
          }
        }
      }
      return events
    }
    // Try to use pubkey index.
    if (authors && authors.length > 0 && (!kinds || kinds.length === 0)) {
      const events : SignedEvent[] = []
      for (const pubkey of authors) {
        const keys = this._by_pubkey.get(pubkey)
        if (keys) {
          for (const key of keys) {
            const event = this._cache.get(key)
            if (event) events.push(event)
          }
        }
      }
      return events
    }
    // If both kinds and authors are specified, use the smaller set.
    if (kinds && kinds.length > 0 && authors && authors.length > 0) {
      // Estimate sizes.
      let kind_count = 0
      for (const kind of kinds) {
        kind_count += this._by_kind.get(kind)?.size ?? 0
      }
      let pubkey_count = 0
      for (const pubkey of authors) {
        pubkey_count += this._by_pubkey.get(pubkey)?.size ?? 0
      }
      // Use smaller index.
      if (kind_count <= pubkey_count) {
        const events : SignedEvent[] = []
        for (const kind of kinds) {
          const keys = this._by_kind.get(kind)
          if (keys) {
            for (const key of keys) {
              const event = this._cache.get(key)
              if (event) events.push(event)
            }
          }
        }
        return events
      } else {
        const events : SignedEvent[] = []
        for (const pubkey of authors) {
          const keys = this._by_pubkey.get(pubkey)
          if (keys) {
            for (const key of keys) {
              const event = this._cache.get(key)
              if (event) events.push(event)
            }
          }
        }
        return events
      }
    }
    // No index can be used.
    return null
  }

  /**
   * Removes expired events from the cache and secondary indexes.
   * @param stamp  Optional timestamp to use as current time (default: now)
   */
  public prune (stamp? : number) : void {
    // For each event in the cache:
    for (const [ key, event ] of this.cache) {
      // If the event is expired,
      if (is_event_expired(event, stamp)) {
        // Remove from kind index.
        this._by_kind.get(event.kind)?.delete(key)
        // Remove from pubkey index.
        this._by_pubkey.get(event.pubkey)?.delete(key)
        // Delete the event from the cache.
        this._cache.delete(key)
      }
    }
  }

  /**
   * Stops the pruning timer and releases resources.
   * Call this method when the cache is no longer needed to prevent memory leaks.
   */
  public close () : void {
    // Clear the pruning timer.
    clearInterval(this._timer)
  }
}
