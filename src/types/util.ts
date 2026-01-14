export type Result<T = any> = OkResult<T> | ErrorResult

export interface OkResult<T = any> {
  ok     : true
  result : T
  error? : any
}

export interface ErrorResult {
  ok      : false
  result? : any
  error   : unknown
}
