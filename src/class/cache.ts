import { PRUNE_INTERVAL }   from '@/const.js'
import { is_event_expired } from '@/lib/event.js'

import {
  get_event_cache_key,
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
 * Event cache with automatic expiration pruning.
 * Stores events keyed by their cache key (varies by event kind).
 * Periodically removes expired events based on expiration tags.
 */
export class EventCache {
  private readonly _cache : Map<string, SignedEvent>
  private readonly _ival  : number

  private _timer : NodeJS.Timeout | undefined

  /**
   * Creates a new event cache.
   * @param prune_ival  Interval in seconds between pruning cycles (default: PRUNE_INTERVAL)
   */
  constructor (prune_ival : number = PRUNE_INTERVAL) {
    this._cache = new Map()
    this._ival  = prune_ival * 1000
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
   * Adds an event to the cache.
   * @param event  The signed event to cache
   */
  public add (event : SignedEvent) {
    // Get the cache key for the event.
    const key = get_event_cache_key(event)
    // If the key is not found, return.
    if (!key) return
    // Cache the event.
    this._cache.set(key, event)
  }

  /** Clears all events from the cache. */
  public clear () {
    // Clear the cache.
    this._cache.clear()
  }

  /**
   * Removes an event from the cache.
   * @param event  The event to remove
   */
  public delete (event : SignedEvent) {
    // Get the cache key for the event.
    const key = get_event_cache_key(event)
    // If the key is not found, return.
    if (!key) return
    // Delete the event from the cache.
    this._cache.delete(key)
  }

  /**
   * Returns events matching the given filters.
   * @param filters  Event filters to match against
   * @returns        Array of matching events
   */
  public filter (filters : EventFilter[]) : SignedEvent[] {
    // Process the filters and return the results.
    return process_filters(this.events, filters)
  }

  /**
   * Removes expired events from the cache.
   * @param stamp  Optional timestamp to use as current time (default: now)
   */
  public prune (stamp? : number) : void {
    // For each event in the cache:
    for (const [ key, event ] of this.cache) {
      // If the event is expired,
      if (is_event_expired(event, stamp)) {
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
