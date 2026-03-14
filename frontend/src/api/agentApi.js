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

export const runAgent = (description) =>
  request(() => api.post('/agent/run/', { project_description: description }));

export const getEmployees = () => request(() => api.get('/employees/'));
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

export default api;
