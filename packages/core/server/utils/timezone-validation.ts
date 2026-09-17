import { z } from 'zod'
import { isValidTimezone } from '../../shared/timezone'

export const timezoneSchema = z.string().trim().max(100).refine(isValidTimezone, 'A valid IANA timezone is required')
