import axios from "axios";

// API базовый URL
const API_BASE_URL = "http://localhost:8000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// API для задач
export const tasksApi = {
  getAllTasks: async () => {
    const response = await apiClient.get("/tasks");

    return response.data;
  },

  addTask: async (task: any) => {
    const response = await apiClient.post("/tasks/add", task);

    return response.data;
  },

  deleteTask: async (room: number) => {
    const response = await apiClient.delete(`/tasks/${room}`);

    return response.data;
  },
};

// API для сотрудников
export const employeesApi = {
  getAllEmployees: async () => {
    const response = await apiClient.get("/employees");

    return response.data;
  },

  getWorkingEmployees: async () => {
    const response = await apiClient.get("/employees/working");

    return response.data;
  },

  toggleEmployeeWorking: async (name: string) => {
    const response = await apiClient.put(`/employees/${name}/toggle`);

    return response.data;
  },

  addEmployee: async (employee: any) => {
    const response = await apiClient.post("/employees/add", employee);

    return response.data;
  },
};

// API для распределения задач
export const housekeepingApi = {
  getCorridors: async () => {
    const response = await apiClient.get("/housekeeping/corridors");

    return response.data;
  },

  assignTasks: async () => {
    const response = await apiClient.post("/housekeeping/assign");

    return response.data;
  },
};

export default {
  tasks: tasksApi,
  employees: employeesApi,
  housekeeping: housekeepingApi,
};
