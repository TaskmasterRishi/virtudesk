"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  FileText,
  Calendar,
  BarChart3,
  Activity,
  Target,
  Timer,
  AlertTriangle,
  RefreshCw,
  UserX,
  Briefcase,
  TrendingDown
} from 'lucide-react';
import { ManagerAnalytics, EmployeeStats, TaskAnalytics, ActivityTimeline } from '@/app/actions/Analytics';
import { useOrganization } from '@clerk/nextjs';
import { enrichEmployeeStatsWithClerkData } from '../_utils/enrichEmployeeStats';
import { getManagerAnalytics } from '@/app/actions/Analytics';

interface ManagerAnalyticsDashboardProps {
  initialData: ManagerAnalytics;
  orgId: string;
}

export default function ManagerAnalyticsDashboard({ initialData, orgId }: ManagerAnalyticsDashboardProps) {
  const { organization } = useOrganization();
  const [analyticsData, setAnalyticsData] = useState<ManagerAnalytics>(initialData);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>(initialData.employeeStats);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh function
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const newData = await getManagerAnalytics(orgId);
      setAnalyticsData(newData);
      
      // Enrich with Clerk data if available
      if (organization) {
        const memberships = await organization.getMemberships();
        const enriched = enrichEmployeeStatsWithClerkData(newData.employeeStats, memberships.data || []);
        setEmployeeStats(enriched);
      } else {
        setEmployeeStats(newData.employeeStats);
      }
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setRefreshing(false);
    }
  }, [orgId, organization]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refreshData]);

  // Initial enrichment
  useEffect(() => {
    const enrichData = async () => {
      if (!organization) {
        setEmployeeStats(analyticsData.employeeStats);
        return;
      }
      setLoading(true);
      try {
        const memberships = await organization.getMemberships();
        const enriched = enrichEmployeeStatsWithClerkData(analyticsData.employeeStats, memberships.data || []);
        setEmployeeStats(enriched);
      } catch (error) {
        console.error('Error enriching data:', error);
      } finally {
        setLoading(false);
      }
    };
    enrichData();
  }, [organization, analyticsData.employeeStats]);

  const formatDuration = (hours: number | null) => {
    if (hours === null) return 'N/A';
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const formatTimeMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Totals based on filtered employeeStats (managers excluded)
  const totalEmployeesDisplay = employeeStats.length;
  const activeEmployeesDisplay = employeeStats.filter(e => e.totalTasks > 0).length;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
                Performance Analytics
              </h1>
              <p className="text-slate-600 text-lg">Comprehensive insights into team productivity and task management</p>
            </div>
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mt-6"></div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-slate-200 shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Total Employees</CardTitle>
                <div className="p-2.5 rounded-lg bg-blue-50">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-slate-900">{totalEmployeesDisplay}</div>
                <p className="text-xs font-medium text-slate-500">
                  {activeEmployeesDisplay} active members
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Total Tasks</CardTitle>
                <div className="p-2.5 rounded-lg bg-indigo-50">
                  <Briefcase className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-slate-900">{analyticsData.taskAnalytics.totalTasks}</div>
                <p className="text-xs font-medium text-slate-500">
                  {analyticsData.taskAnalytics.completionRate}% completion rate
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Completion Rate</CardTitle>
                <div className="p-2.5 rounded-lg bg-emerald-50">
                  <Target className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-slate-900">{analyticsData.taskAnalytics.completionRate}%</div>
                <Progress value={analyticsData.taskAnalytics.completionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Overdue Tasks</CardTitle>
                <div className="p-2.5 rounded-lg bg-red-50">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-red-600">{analyticsData.taskAnalytics.overdueTasks}</div>
                <p className="text-xs font-medium text-slate-500">Requires immediate attention</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Tasks by Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(analyticsData.taskAnalytics.tasksByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-sm font-medium text-slate-600 capitalize">{status.replace('_', ' ')}</span>
                  <span className="text-base font-bold text-slate-900">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Tasks by Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(analyticsData.taskAnalytics.tasksByPriority).map(([priority, count]) => (
                <div key={priority} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-sm font-medium text-slate-600 capitalize">{priority}</span>
                  <span className="text-base font-bold text-slate-900">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Weekly Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Tasks Created</span>
                <span className="text-base font-bold text-slate-900">{analyticsData.taskAnalytics.tasksCreatedThisWeek}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm font-medium text-slate-600">Tasks Completed</span>
                <span className="text-base font-bold text-emerald-600">{analyticsData.taskAnalytics.tasksCompletedThisWeek}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Task Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Pending</span>
                <span className="text-base font-bold text-slate-900">{analyticsData.taskAnalytics.pendingTasks}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">In Progress</span>
                <span className="text-base font-bold text-blue-600">{analyticsData.taskAnalytics.inProgressTasks}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm font-medium text-slate-600">Completed</span>
                <span className="text-base font-bold text-emerald-600">{analyticsData.taskAnalytics.completedTasks}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="employees" className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200">
            <TabsList className="bg-transparent border-0 p-0 h-auto">
              <TabsTrigger 
                value="employees" 
                className="px-6 py-3 text-sm font-semibold data-[state=active]:border-b-2 data-[state=active]:border-slate-900 data-[state=active]:bg-transparent rounded-none"
              >
                Employee Performance
              </TabsTrigger>
              <TabsTrigger 
                value="afk-worktime" 
                className="px-6 py-3 text-sm font-semibold data-[state=active]:border-b-2 data-[state=active]:border-slate-900 data-[state=active]:bg-transparent rounded-none"
              >
                Attendance & Work Time
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="px-6 py-3 text-sm font-semibold data-[state=active]:border-b-2 data-[state=active]:border-slate-900 data-[state=active]:bg-transparent rounded-none"
              >
                Activity Timeline
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="employees" className="space-y-6 mt-6">
            <Card className="border-slate-200 shadow-lg bg-white">
              <CardHeader className="border-b border-slate-200 bg-slate-50">
                <CardTitle className="text-xl font-bold text-slate-900">Employee Performance Metrics</CardTitle>
                <CardDescription className="text-slate-600">Detailed performance analysis for each team member</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="text-center py-12 text-slate-500">Loading employee data...</div>
                ) : employeeStats.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No employee data available</div>
                ) : (
                  <div className="space-y-5">
                    {employeeStats.map((employee) => (
                      <div 
                        key={employee.userId} 
                        className="border border-slate-200 rounded-lg p-5 bg-white hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4 flex-1">
                            <Avatar className="h-12 w-12 border-2 border-slate-200">
                              <AvatarImage src="" />
                              <AvatarFallback className="bg-slate-100 text-slate-700 font-semibold">
                                {employee.userName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-lg font-bold text-slate-900">{employee.userName}</h3>
                                {employee.isAFK && (
                                  <Badge className="bg-amber-500 text-white border-amber-600 font-semibold animate-pulse">
                                    <UserX className="h-3 w-3 mr-1" />
                                    Currently AFK
                                  </Badge>
                                )}
                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300 font-medium">
                                  {employee.completionRate}% Complete
                                </Badge>
                              </div>
                              {employee.userEmail && (
                                <p className="text-sm text-slate-500 mb-2">{employee.userEmail}</p>
                              )}
                              <p className="text-xs text-slate-400">Last active: {formatDate(employee.lastActivity)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Tasks</div>
                            <div className="text-2xl font-bold text-slate-900">{employee.totalTasks}</div>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Completed</div>
                            <div className="text-2xl font-bold text-emerald-700">{employee.completedTasks}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">In Progress</div>
                            <div className="text-2xl font-bold text-blue-700">{employee.inProgressTasks}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pending</div>
                            <div className="text-2xl font-bold text-slate-900">{employee.pendingTasks}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Reports</div>
                            <div className="text-xl font-bold text-slate-900">{employee.reportsSubmitted}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Avg. Time</div>
                            <div className="text-xl font-bold text-slate-900">{formatDuration(employee.averageCompletionTime)}</div>
                          </div>
                          <div className={`rounded-lg p-3 border ${employee.overdueTasks > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${employee.overdueTasks > 0 ? 'text-red-700' : 'text-emerald-700'}`}>Overdue</div>
                            <div className={`text-xl font-bold ${employee.overdueTasks > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                              {employee.overdueTasks}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="font-semibold text-slate-700">Task Completion Progress</span>
                            <span className="font-bold text-slate-900">{employee.completionRate}%</span>
                          </div>
                          <Progress value={employee.completionRate} className="h-2.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="afk-worktime" className="space-y-6 mt-6">
            <Card className="border-slate-200 shadow-lg bg-white">
              <CardHeader className="border-b border-slate-200 bg-slate-50">
                <CardTitle className="text-xl font-bold text-slate-900">Attendance & Work Time Tracking</CardTitle>
                <CardDescription className="text-slate-600">Daily work time completion and AFK status monitoring</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="text-center py-12 text-slate-500">Loading employee data...</div>
                ) : employeeStats.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No employee data available</div>
                ) : (
                  <div className="space-y-5">
                    {employeeStats.map((employee) => {
                      const isGoalComplete = employee.workTimeCompletionPercent >= 100;
                      
                      return (
                        <div 
                          key={employee.userId} 
                          className={`border rounded-lg p-5 bg-white hover:shadow-md transition-shadow relative overflow-hidden ${
                            employee.isAFK 
                              ? 'border-amber-400 border-2 bg-amber-50/30' 
                              : 'border-slate-200'
                          }`}
                        >
                          {/* AFK Status Bar */}
                          {employee.isAFK && (
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 animate-pulse" />
                          )}
                          
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4 flex-1">
                              <Avatar className={`h-12 w-12 border-2 relative ${
                                employee.isAFK ? 'border-amber-400' : 'border-slate-200'
                              }`}>
                                {employee.isAFK && (
                                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 rounded-full border-2 border-white animate-pulse" />
                                )}
                                <AvatarImage src="" />
                                <AvatarFallback className={`font-semibold ${
                                  employee.isAFK ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {employee.userName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <h3 className={`text-lg font-bold ${
                                    employee.isAFK ? 'text-amber-900' : 'text-slate-900'
                                  }`}>
                                    {employee.userName}
                                  </h3>
                                  {employee.isAFK && (
                                    <Badge className="bg-amber-500 text-white border-amber-600 font-semibold shadow-md">
                                      <UserX className="h-3 w-3 mr-1" />
                                      Currently AFK
                                    </Badge>
                                  )}
                                </div>
                                {employee.userEmail && (
                                  <p className="text-sm text-slate-500">{employee.userEmail}</p>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`font-semibold px-3 py-1 ${
                                isGoalComplete 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                  : 'bg-blue-50 text-blue-700 border-blue-300'
                              }`}
                            >
                              {isGoalComplete ? 'Goal Achieved' : `${employee.workTimeCompletionPercent}% Complete`}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Work Time</div>
                              <div className="text-xl font-bold text-blue-900">{formatTimeMs(employee.workTimeMs)}</div>
                            </div>
                            <div className={`rounded-lg p-3 border ${employee.remainingTimeMs > 0 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'}`}>
                              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${employee.remainingTimeMs > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>Remaining</div>
                              <div className={`text-xl font-bold ${employee.remainingTimeMs > 0 ? 'text-orange-900' : 'text-emerald-900'}`}>
                                {employee.remainingTimeMs > 0 ? formatTimeMs(employee.remainingTimeMs) : 'Complete'}
                              </div>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">AFK Count</div>
                              <div className="text-xl font-bold text-amber-900">{employee.afkCount}</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Daily Goal</div>
                              <div className="text-xl font-bold text-slate-900">8 hours</div>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="font-semibold text-slate-700">Work Time Progress</span>
                              <span className="font-bold text-slate-900">{employee.workTimeCompletionPercent}%</span>
                            </div>
                            <Progress 
                              value={Math.min(100, employee.workTimeCompletionPercent)} 
                              className={`h-3 ${isGoalComplete ? 'bg-emerald-500' : ''}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Summary Statistics */}
                    <div className="mt-6 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                      <h4 className="text-lg font-bold text-slate-900 mb-4">Summary Statistics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total AFK Events</div>
                          <div className="text-2xl font-bold text-amber-600">
                            {employeeStats.reduce((sum, e) => sum + e.afkCount, 0)}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Currently AFK</div>
                          <div className="text-2xl font-bold text-amber-600">
                            {employeeStats.filter(e => e.isAFK).length}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Goal Completed</div>
                          <div className="text-2xl font-bold text-emerald-600">
                            {employeeStats.filter(e => e.workTimeCompletionPercent >= 100).length}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Avg. Completion</div>
                          <div className="text-2xl font-bold text-slate-900">
                            {employeeStats.length > 0
                              ? Math.round(employeeStats.reduce((sum, e) => sum + e.workTimeCompletionPercent, 0) / employeeStats.length)
                              : 0}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6 mt-6">
            <Card className="border-slate-200 shadow-lg bg-white">
              <CardHeader className="border-b border-slate-200 bg-slate-50">
                <CardTitle className="text-xl font-bold text-slate-900">Activity Timeline</CardTitle>
                <CardDescription className="text-slate-600">Task and report activity trends over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {analyticsData.activityTimeline.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No activity data available</div>
                ) : (
                  <div className="space-y-3">
                    {analyticsData.activityTimeline.slice(-14).map((day) => {
                      const date = new Date(day.date);
                      
                      return (
                        <div 
                          key={day.date} 
                          className="flex items-center gap-6 p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                        >
                          <div className="w-28 text-sm font-semibold text-slate-700">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-50">
                                <FileText className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</div>
                                <div className="text-base font-bold text-slate-900">{day.tasksCreated}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-emerald-50">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Completed</div>
                                <div className="text-base font-bold text-emerald-700">{day.tasksCompleted}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-purple-50">
                                <Activity className="h-4 w-4 text-purple-600" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reports</div>
                                <div className="text-base font-bold text-purple-700">{day.reportsSubmitted}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
