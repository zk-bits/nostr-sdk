export interface RelayConfig {
  debug      : boolean
  max_events : number
  purge_ival : number | null
  timeout    : number
  verbose    : boolean
}

export interface RelayPolicy {
  send : boolean
  recv : boolean
}
