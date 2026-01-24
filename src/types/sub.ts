export type SubscriptionFilterMode = 'eose' | 'event' | 'timeout'

export interface SubscriptionFilterOptions {
  duration? : number
  mode?     : SubscriptionFilterMode
}

export interface SubscriptionData {
  count   : number
  init    : boolean
  retries : number
  since   : number
}
