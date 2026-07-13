export enum UserRole {
  ADMIN = 'admin',
  DISPATCHER = 'dispatcher',
  DRIVER = 'driver',
}

export enum AmbulanceStatus {
  ACTIVE = 'active',
  BUSY = 'busy',
  INACTIVE = 'inactive',
}

export enum AlertStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  EN_ROUTE = 'en_route',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
