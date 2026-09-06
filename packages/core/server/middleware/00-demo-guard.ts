import { defineEventHandler } from 'h3'
import { isPortalDemo, rejectDemoAction } from '../utils/demo'
import { isDemoRequestAllowed } from '../../shared/demo-policy'

export default defineEventHandler((event) => {
  if (isPortalDemo() && !isDemoRequestAllowed(event.method, event.path)) {
    rejectDemoAction(event)
  }
})
