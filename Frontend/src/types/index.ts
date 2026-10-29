export interface User {
  id: number;
  name: string;
  email: string;
  empId?: string;
  role: 'USER' | 'MANAGER' | 'ADMIN';
  passwordResetRequired?: boolean;
  token?: string;
  department?: string;
  createdAt?: string;
  onboardedBy?: number;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  objective?: string;
  teamSize?: number;
  deadline?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: User;
  projectType?: string;
  category?: string;
  teamMembers?: User[];
  totalBudget?: number;
  contingencyPercent?: number;
  defaultHourlyRate?: number;
  costPerStoryPoint?: number;
  budgetAllocationMethod?: 'STORY_POINT_WEIGHTED' | 'CATEGORY_BASED' | 'TIME_BASED' | string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  columnId: number;
  orderIndex: number;
  assignee?: User;
  assigneeId?: number;
  coAssignee?: User;
  coAssigneeId?: number;
  reporter?: User;
  reporterId?: number;
  project?: Project;
  projectId?: number;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  tags?: string[];
  attachments?: string[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  environment?: string;
  status?: string;
  issueType?: string;
  storyPoints?: number;
  sprintId?: number;
  sprint?: Sprint;
  parentTask?: Task;
  parentId?: number;
  subTasks?: Task[];
  epicColor?: string;
  projectSequence?: number;
  fixVersionId?: number;
  fixVersion?: Version;
  affectsVersionId?: number;
  affectsVersion?: Version;
  originalEstimate?: string;
  originalEstimateSeconds?: number;
  timeSpentSeconds?: number;
  remainingEstimateSeconds?: number;
  workLogs?: WorkLog[];
  allocatedBudget?: number;
  actualCost?: number;
  budgetAllocationSource?: 'AUTOMATIC' | 'MANUAL' | string;
  category?: string;
}

export interface WorkLog {
  id: number;
  taskId: number;
  user: User;
  timeSpent: string;
  timeSpentSeconds: number;
  workDate: string;
  comment?: string;
  createdAt: string;
}

export interface Version {
  id: number;
  name: string;
  description?: string;
  startDate?: string;
  releaseDate?: string;
  status: 'UNRELEASED' | 'RELEASED' | 'ARCHIVED';
  releaseNotes?: string;
  projectId: number;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | string;
  projectId: number;
  initialCommitmentPoints?: number;
}

export interface Comment {
  id: number;
  content: string;
  user: User;
  createdAt: string;
}

export interface BoardColumn {
  id: number;
  projectId: number;
  name: string;
  orderIndex: number;
}

export interface Notification {
  id: number;
  userId: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface ProjectBudgetCategoryDTO {
  id?: number;
  category: string;
  allocationPercent: number;
  allocatedAmount?: number;
}

export interface ProjectBudgetSettingsRequest {
  totalBudget?: number;
  contingencyPercent?: number;
  defaultHourlyRate?: number;
  costPerStoryPoint?: number;
  budgetAllocationMethod?: string;
  categories?: ProjectBudgetCategoryDTO[];
  changeReason?: string;
}

export interface ProjectBudgetHistoryDTO {
  id: number;
  projectId: number;
  previousTotalBudget: number | null;
  newTotalBudget: number | null;
  previousContingencyPercent: number | null;
  newContingencyPercent: number | null;
  previousAllocationMethod: string | null;
  newAllocationMethod: string | null;
  previousHourlyRate: number | null;
  newHourlyRate: number | null;
  previousCostPerStoryPoint: number | null;
  newCostPerStoryPoint: number | null;
  changeSummary: string;
  comment?: string;
  performedBy?: string;
  performedByEmpId?: string;
  createdAt: string;
}

export interface TaskBudgetUpdateRequest {
  allocatedBudget?: number;
  actualCost?: number;
  budgetAllocationSource?: 'AUTOMATIC' | 'MANUAL' | string;
  category?: string;
}

export interface TaskFinancialDTO {
  taskId: number;
  taskKey: string;
  taskName: string;
  category: string;
  storyPoints: number;
  originalEstimate?: string;
  originalEstimateSeconds?: number;
  timeSpent?: string;
  timeSpentSeconds?: number;
  hourlyRate: number;
  allocatedBudget: number;
  actualCost: number;
  costVariance: number;
  budgetUtilization: number;
  budgetAllocationSource: 'AUTOMATIC' | 'MANUAL' | string;
  status: string;
  issueType: string;
  priority: string;
  assigneeName: string;
}

export interface CategoryFinancialSummaryDTO {
  category: string;
  allocationPercent: number;
  allocatedBudget: number;
  actualCost: number;
  variance: number;
  utilizationPercent: number;
  taskCount: number;
}

export interface MonthlyCostDTO {
  period: string;
  actualCost: number;
  timeSpentSeconds: number;
}

export interface ProjectFinancialSummaryDTO {
  projectId: number;
  projectName: string;
  totalBudget: number;
  contingencyPercent: number;
  contingencyAmount: number;
  availableWorkBudget: number;
  totalAllocatedBudget: number;
  totalActualCost: number;
  remainingBudget: number;
  budgetUtilizationPercent: number;
  costVariance: number;
  totalStoryPoints: number;
  costPerStoryPoint: number;
  totalTimeSpentSeconds: number;
  totalTimeSpentFormatted: string;
  defaultHourlyRate: number;
  budgetAllocationMethod: 'STORY_POINT_WEIGHTED' | 'CATEGORY_BASED' | 'TIME_BASED' | string;
  taskCount: number;
  categories: ProjectBudgetCategoryDTO[];
  categorySummaries: CategoryFinancialSummaryDTO[];
  costTrend: MonthlyCostDTO[];
}

export interface BurndownDailyPoint {
  dayIndex: number;
  date: string;
  dayLabel: string;
  idealRemaining: number;
  actualRemaining: number | null;
  originalCommitment: number;
  currentScope: number;
  completedPoints: number;
  addedPoints: number;
  removedPoints: number;
  dailyCreated?: number;
  dailyCompleted?: number;
  events?: SprintScopeChange[];
}

export interface SprintScopeChange {
  id: number;
  sprintId: number;
  taskId?: number;
  taskKey?: string;
  taskTitle?: string;
  changeType: 'TASK_ADDED' | 'TASK_REMOVED' | 'POINTS_INCREASED' | 'POINTS_DECREASED' | 'TASK_REOPENED' | 'TASK_COMPLETED' | string;
  fromPoints?: number;
  toPoints?: number;
  pointsDiff: number;
  changedBy: string;
  changedAt: string;
  comment?: string;
}

export interface BurndownAlert {
  id: string;
  title: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  type: string;
  description: string;
  detectionDate: string;
  affectedDays?: number;
  affectedPoints?: number;
  relatedTask?: string;
  potentialCauses: string[];
  recommendedAction: string;
}

export interface BurndownSummary {
  sprintId: number;
  sprintName: string;
  startDate?: string;
  endDate?: string;
  status: string;
  initialCommitment: number;
  currentScope: number;
  addedPoints: number;
  removedPoints: number;
  completedPoints: number;
  remainingPoints: number;
  scopeCreepIndex: number | null;
  completionPercentage: number;
  activeAlertsCount: number;
}

export interface BurndownResponse {
  summary: BurndownSummary;
  dailyPoints: BurndownDailyPoint[];
  anomalies: BurndownAlert[];
  scopeChanges: SprintScopeChange[];
}

export interface VelocitySprint {
  sprintId: number;
  sprintName: string;
  startDate?: string;
  endDate?: string;
  status: string;
  committedPoints: number;
  completedPoints: number;
  difference: number;
  isCompleted: boolean;
}

export interface VelocityAnalyticsResponse {
  projectId: number;
  sprintsAnalyzedCount: number;
  averageVelocity: number;
  roundedAverageVelocity: number;
  latestSprintVelocity: number;
  highestSprintVelocity: number;
  lowestSprintVelocity: number;
  totalCompletedPoints: number;
  sprints: VelocitySprint[];
}

export interface VelocityStability {
  projectId: number;
  sprintsAnalyzedCount: number;
  averageVelocity: number;
  roundedAverageVelocity: number;
  recentVelocity: number;
  roundedRecentVelocity: number;
  standardDeviation: number;
  roundedStandardDeviation: number;
  coefficientOfVariation: number;
  stabilityIndicator: 'STABLE' | 'MODERATELY_VARIABLE' | 'HIGHLY_VARIABLE' | 'N_A';
  stabilityDescription: string;
  highestVelocity: number;
  lowestVelocity: number;
}

export interface MemberCapacity {
  empId: string;
  memberName: string;
  workingDays: number;
  dailyHours: number;
  availabilityPercentage: number;
  availableHours: number;
  availableDays: number;
  storyPointsCapacity?: number | null;
  isManual?: boolean;
}

export interface TeamCapacity {
  projectId: number;
  sprintId?: number | null;
  sprintName?: string;
  teamMemberCount: number;
  workingDays: number;
  totalAvailableHours: number;
  totalAvailablePersonDays: number;
  capacityStoryPoints: number;
  isManuallyConfigured: boolean;
  capacityUnit: string;
  hoursPerStoryPoint: number;
  calculationBasis: string;
  memberCapacities: MemberCapacity[];
}

export interface VelocityPlanningRecommendation {
  projectId: number;
  historicalSprintsUsed: number;
  observedRangeMin: number;
  observedRangeMax: number;
  historicalAverage: number;
  roundedHistoricalAverage: number;
  currentTeamCapacity: number;
  currentTeamCapacityHours: number;
  currentTeamCapacityDays: number;
  capacityUnit: string;
  isCapacityConfigured: boolean;
  isCapacityManual: boolean;
  suggestedPlanningBaseline: number;
  roundedSuggestedPlanningBaseline: number;
  insufficientDataWarning: boolean;
  capacityConfigRequired: boolean;
  advisoryNote: string;
  includedSprints: VelocitySprint[];
}

export interface SprintCapacityRequest {
  projectId: number;
  sprintId?: number | null;
  workingDays?: number;
  dailyHours?: number;
  storyPointsCapacity?: number;
  hoursPerStoryPoint?: number;
  isManual?: boolean;
  memberCapacities?: MemberCapacity[];
}

