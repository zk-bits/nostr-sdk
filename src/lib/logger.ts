/**
 * Logger factory for consistent logging across classes.
 * Provides debug and info logging controlled by config flags.
 */

export interface Logger {
  debug : (...msg : any[]) => void
  info  : (...msg : any[]) => void
}

export interface LoggerConfig {
  debug   : boolean
  verbose : boolean
}

/**
 * Creates a logger with the specified prefix and config.
 * @param prefix  Prefix string to prepend to all messages (e.g., '[ relay ]')
 * @param config  Configuration with debug and verbose flags
 * @returns       Logger with debug and info methods
 */
export function create_logger (prefix : string, config : LoggerConfig) : Logger {
  return {
    debug : (...msg : any[]) => config.debug   && console.log(prefix, ...msg),
    info  : (...msg : any[]) => config.verbose && console.log(prefix, ...msg),
  }
}
