import { NostrRelay } from '@/class/relay.js'

const port  = parseInt(process.argv[2] ?? '8080')
const relay = new NostrRelay({ debug : true, verbose : true })

process.on('SIGINT', () => {
  relay.stop()
  process.exit(0)
})

try {
  relay.start({ port })
} catch (err) {
  console.error('failed to start relay:', err)
  process.exit(1)
}
