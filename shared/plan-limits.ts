// Plan limits configuration for route optimization
export interface PlanLimits {
  maxRouteAddresses: number;
  maxVehicles: number;
  maxTechnicians: number;
  maxMonthlyRequests: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  basic: {
    maxRouteAddresses: 15,
    maxVehicles: 3,
    maxTechnicians: 5,
    maxMonthlyRequests: 1000,
  },
  professional: {
    maxRouteAddresses: 50,
    maxVehicles: 10,
    maxTechnicians: 20,
    maxMonthlyRequests: 5000,
  },
  enterprise: {
    maxRouteAddresses: 150,
    maxVehicles: 50,
    maxTechnicians: 100,
    maxMonthlyRequests: 20000,
  },
  custom: {
    maxRouteAddresses: 500,
    maxVehicles: 200,
    maxTechnicians: 500,
    maxMonthlyRequests: 100000,
  },
};

// Default plan for users without specified plan
export const DEFAULT_PLAN = 'basic';

export function getPlanLimits(planType?: string): PlanLimits {
  const plan = planType || DEFAULT_PLAN;
  return PLAN_LIMITS[plan.toLowerCase()] || PLAN_LIMITS[DEFAULT_PLAN];
}