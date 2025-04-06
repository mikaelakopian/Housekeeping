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

  getRoomTasks: async () => {
    try {
      // Используем API сервера вместо статического файла
      const response = await apiClient.get("/tasks");

      const data = response.data;

      // Проверяем и нормализуем данные - преобразуем 'coridor' в 'corridor' если нужно
      if (data && data.tasks) {
        data.tasks = data.tasks.map((task: any) => {
          // Если есть coridor, но нет corridor - копируем его
          if (task.coridor !== undefined && task.corridor === undefined) {
            task.corridor = task.coridor;
            // Удаляем поле coridor, чтобы избежать дублирования
            delete task.coridor;
          }

          return task;
        });
      }

      return data;
    } catch (error) {
      console.error("Error fetching room tasks:", error);

      return { tasks: [] };
    }
  },

  saveRoomTasks: async (tasks: any) => {
    try {
      const response = await apiClient.post("/tasks", { tasks });

      return response.data;
    } catch (error) {
      console.error("Error saving room tasks:", error);
      throw error;
    }
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

  addEmployee: async (name: string) => {
    const response = await apiClient.post("/employees/add", { name });

    return response.data;
  },

  deleteEmployee: async (name: string) => {
    const response = await apiClient.delete(`/employees/${name}`);

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
