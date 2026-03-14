import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

const extractErrorMessage = (error) => {
  const backendMessage =
    error?.response?.data?.detail ||
    error?.response?.data?.error ||
    error?.response?.data?.project_description?.[0] ||
    error?.response?.data?.remaining_description?.[0];

  return backendMessage || error.message || 'Unexpected request failure';
};

const request = async (runner) => {
  try {
    const response = await runner();
    return response.data;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};

export const runAgent = (description, teamSize, reshuffleToken = 0, avoidConflicts = false) =>
  request(() =>
    api.post('/agent/run/', {
      project_description: description,
      team_size: teamSize,
      reshuffle_token: reshuffleToken,
      avoid_conflicts: avoidConflicts,
    })
  );

export const getEmployees = () => request(() => api.get('/employees/'));
export const createEmployee = (employee) => request(() => api.post('/employees/', employee));
export const addEmployee = (employee) => request(() => api.post('/employees/add/', employee));
export const updateEmployee = (employeeId, employee) =>
  request(() => api.put(`/employees/${employeeId}/`, employee));
export const deleteEmployee = (employeeId) => request(() => api.delete(`/employees/${employeeId}/`));
export const getEmployeeStatuses = () => request(() => api.get('/employees/status/'));
export const getProjects = () => request(() => api.get('/projects/'));
export const getTools = () => request(() => api.get('/tools/'));
export const getHistory = () => request(() => api.get('/history/'));

export const replanAgent = (completedTasks, remainingDesc) =>
  request(() =>
    api.post('/agent/replan/', {
      completed_tasks: completedTasks,
      remaining_description: remainingDesc,
    })
  );

export const sendAssignments = (payload) =>
  request(() => api.post('/agent/send-assignments/', payload));

export const getTaskBoard = () => request(() => api.get('/taskboard/'));
export const createTaskBoardProject = (payload) => request(() => api.post('/taskboard/create/', payload));
export const addTaskBoardMember = (projectId, member) =>
  request(() => api.patch(`/taskboard/${projectId}/add-member/`, { member }));
export const removeTaskBoardMember = (projectId, member) =>
  request(() => api.patch(`/taskboard/${projectId}/remove-member/`, { member }));
export const completeTaskBoardProject = (projectId) =>
  request(() => api.patch(`/taskboard/${projectId}/complete/`, {}));

export const getAnalytics = (period = '7d') => request(() => api.get(`/analytics/?period=${period}`));
export const getActivities = () => request(() => api.get('/activities/'));

export default api;
