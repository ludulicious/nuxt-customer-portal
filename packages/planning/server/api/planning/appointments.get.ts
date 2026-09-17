import { defineEventHandler, getQuery } from 'h3'
import { listAppointments } from '@nuxt-customer-portal/planning/server/utils/appointments'

export default defineEventHandler((event) => listAppointments(event, getQuery(event)))
