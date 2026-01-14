import { is_event_expired } from '@/lib/event.js'

import {
  get_event_cache_key,
  process_filters
} from '@/lib/filter.js'

import type {
  EventFilter,
  SignedEvent
} from '@/types/index.js'

export const PRUNE_INTERVAL = 30

export class KeyCache {
  private readonly _cache : Set<string> = new Set()
  private readonly _limit : number

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

  public add (key : string) : void {
    // Add the hash to the cache.
    this._cache.add(key)
    // If the cache is full, remove the oldest hash.
    if (this._cache.size >= this._limit) {
      // Get the oldest hash.
      const head = this._next()
      // If the oldest hash is defined, remove it.
      if (head) this._cache.delete(head)
    }
  }

  public clear () : void {
    // Clear the cache.
    this._cache.clear()
  }

  public has (key : string) : boolean {
    // Check if the hash is in the cache.
    return this._cache.has(key)
  }
}

export class EventCache {
  private readonly _cache : Map<string, SignedEvent>
  private readonly _ival  : number

  private _timer : NodeJS.Timeout | undefined

  constructor (prune_ival : number = PRUNE_INTERVAL) {
    this._cache = new Map()
    this._ival  = prune_ival
    // Start the cache pruning.
    this._start()
  }

  private _start () : void {
    // Clear the existing timer if it exists.
    clearInterval(this._timer)
    // Set a new timer to prune the cache.
    this._timer = setInterval(() => this.prune(), this._ival * 1000).unref()
  }

  public get cache () {
    return this._cache
  }

  public get events () {
    return Array.from(this._cache.values())
  }

  public add (event : SignedEvent) {
    // Get the cache key for the event.
    const key = get_event_cache_key(event)
    // If the key is not found, return.
    if (!key) return
    // Cache the event.
    this._cache.set(key, event)
  }

  public clear () {
    // Clear the cache.
    this._cache.clear()
  }

  public delete (event : SignedEvent) {
    // Get the cache key for the event.
    const key = get_event_cache_key(event)
    // If the key is not found, return.
    if (!key) return
    // Delete the event from the cache.
    this._cache.delete(key)
  }

  public filter (filters : EventFilter[]) : SignedEvent[] {
    // Process the filters and return the results.
    return process_filters(this.events, filters)
  }

  public prune (stamp? : number) : void {
    // For each event in the cache:
    for (const [ key, event ] of this.cache) {
      // If the event is expired,
      if (is_event_expired(event, stamp)) {
        // Delete the event from the cache.
        this._cache.delete(key)
        // Continue to the next event.
        continue
      }
    }
  }
}
