"use client";

import {
  Accordion,
  AccordionItem,
  Badge,
  Button,
  Card,
  Divider,
  Select,
  SelectItem,
} from "@heroui/react";
import { addDays, format, isAfter, set } from "date-fns"; // Import date-fns functions
import Image from "next/image";
import { useEffect, useState } from "react";

import api from "../services/api";

import { subtitle, title } from "@/components/primitives";
import EmployeeAvatar from "@/components/EmployeeAvatar";

// Определение типов для данных
interface Employee {
  name: string;
  istodayworking: boolean;
  hire_date?: string; // Дата найма в формате YYYY-MM-DD
  team?: number; // ID команды, к которой принадлежит сотрудник
}

// Интерфейс для команды сотрудников
interface Team {
  id: number;
  members: string[]; // Имена сотрудников в команде
}

// Функция для проверки новичка (работает менее 3 месяцев)
const isNewEmployee = (employee: Employee) => {
  if (!employee.hire_date) return false;

  const hireDate = new Date(employee.hire_date);
  const currentDate = new Date();

  // Разница в миллисекундах
  const diffTime = currentDate.getTime() - hireDate.getTime();

  // Разница в днях
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // Если прошло менее 90 дней (примерно 3 месяца)
  return diffDays < 90;
};

// Интерфейс для заданий из tasks.json
interface RoomTask {
  room: number;
  type: string;
  note: string;
  hotelside?: string; // east или west
  floor?: number; // этаж
  hasstorage?: boolean; // имеет хранилище
  corridor?: number; // номер коридора
}

// Расширенный интерфейс для задачи с расчетом времени
interface CalculatedTask extends RoomTask {
  estimated_time: number;
  description: string; // Добавляем описание для отображения
}

// Функция для определения цвета строки на основе коридора
const getRowColor = (task: RoomTask): string => {
  if (!task.corridor) return "bg-gray-50";

  // Цвет по номеру коридора - использовать нежные пастельные тона
  switch (task.corridor) {
    case 1:
      return "bg-sky-50"; // Западная, этаж 1 - нежно-голубой
    case 2:
      return "bg-violet-50"; // Западная, этаж 2 - нежно-фиолетовый
    case 3:
      return "bg-lime-50"; // Восточная, этаж 1 - нежно-зеленый
    case 4:
      return "bg-teal-50"; // Восточная, этаж 2 (первый сегмент) - нежно-бирюзовый
    case 5:
      return "bg-amber-50"; // Восточная, этаж 2 (второй сегмент) - нежно-янтарный
    case 6:
      return "bg-rose-50"; // Восточная, этаж 3 - нежно-розовый
    default:
      return "bg-gray-50";
  }
};

// Функция для получения названия типа задания
const getTaskTypeName = (type: string): string => {
  switch (type) {
    case "V":
      return "Выезд";
    case "B":
      return "Базовая уборка";
    case "N":
      return "Новое заселение";
    case "V/N":
      return "Выезд с заездом";
    case "-":
      return "Не требует уборки";
    default:
      return type;
  }
};

// Интерфейс для назначенного задания (внутри Assignment)
interface AssignedTask {
  room: number;
  description: string;
  estimated_time: number;
  raw_estimated_time?: number; // Исходное время без учета команды
  corridor?: number; // Добавляем коридор для расчетов
}

// Обновленный интерфейс для назначения
interface Assignment {
  employee: string;
  team_members?: string[]; // Имена сотрудников в команде
  team_size?: number; // Количество сотрудников в команде
  efficiency_factor?: number; // Коэффициент эффективности команды
  tasks: AssignedTask[];
  total_task_time: number; // Только время задач
  total_transition_time: number; // Только время переходов
  total_time_before_break: number; // Общее время до перерыва (если применимо)
  break_time_added: number; // Добавленное время перерыва (0 или 15)
  total_effective_time: number; // Финальное время (задачи + переходы + перерыв)
  needs_trolley: boolean;
  is_overtime: boolean; // Флаг превышения рабочего времени
  estimated_finish_time_str: string; // Расчетное время окончания
}

// Обновленный интерфейс для результата назначения
interface AssignmentResult {
  assignments: Assignment[];
  too_many_trolleys: boolean; // Предупреждение, если > 2 сотрудников нуждаются в тележке
}

// Типы заданий для выбора
const taskTypes = [
  { value: "V", label: "V - Выезд" },
  { value: "B", label: "B - Базовая уборка" },
  { value: "N", label: "N - Новое заселение" },
  { value: "V/N", label: "V/N - Выезд с заездом" },
  { value: "-", label: "- - Не требует уборки" },
];

// Примечания для выбора
const notesOptions = [
  { value: "", label: "-" },
  { value: "дополнительная кровать", label: "дополнительная кровать" },
  { value: "установка детской кровати", label: "установка детской кровати" },
  { value: "другое", label: "Другое" },
];

// Проверка комнаты на наличие склада
const doesRoomHaveStorage = (roomNumber: number): boolean => {
  // По указанию клиента, склад есть только в комнатах:
  // Комнаты 15-22 (коридор 1)
  // Комнаты 201-207 (коридор 3)
  // Комнаты 38-46 (коридор 6)

  if (
    (roomNumber >= 15 && roomNumber <= 22) ||
    (roomNumber >= 201 && roomNumber <= 207) ||
    (roomNumber >= 38 && roomNumber <= 46)
  ) {
    return true;
  }

  return false;
};

// Детали коридоров для расчета переходов
const corridorDetails: Record<
  number,
  { side: "west" | "east"; floor: number; hasStorage: boolean }
> = {
  1: { side: "west", floor: 1, hasStorage: false }, // Западная, 1й этаж - нет склада
  2: { side: "west", floor: 2, hasStorage: false }, // Западная, 2й этаж - нет склада
  3: { side: "east", floor: 1, hasStorage: false }, // Восточная, 1й этаж - нет склада
  4: { side: "east", floor: 2, hasStorage: false }, // Восточная, 2й этаж (1й сегмент) - нет склада
  5: { side: "east", floor: 2, hasStorage: false }, // Восточная, 2й этаж (2й сегмент) - нет склада
  6: { side: "east", floor: 3, hasStorage: false }, // Восточная, 3й этаж - нет склада
};

// Функция для расчета времени перехода между коридорами
const getTransitionTime = (
  corridor1: number | undefined,
  corridor2: number | undefined,
): number => {
  if (!corridor1 || !corridor2 || corridor1 === corridor2) {
    return 0; // No transition or missing info
  }

  // Special case: adjacent corridors on the same floor (4 and 5)
  if (
    (corridor1 === 4 && corridor2 === 5) ||
    (corridor1 === 5 && corridor2 === 4)
  ) {
    return 1 * 3; // 1 minute * 3 = 3 minutes (TRIPLED)
  }

  const details1 = corridorDetails[corridor1];
  const details2 = corridorDetails[corridor2];

  if (!details1 || !details2) {
    console.warn(
      `Could not find details for corridors ${corridor1} or ${corridor2}`,
    );

    return 2 * 3; // Return average time (2 min) * 3 = 6 minutes (TRIPLED) if no data
  }

  let baseTransitionTime = 0;
  let currentFloor = details1.floor;
  let currentSide = details1.side;
  const targetFloor = details2.floor;
  const targetSide = details2.side;

  // If sides are different
  if (currentSide !== targetSide) {
    // If not on the first floor, go down/up to the first floor
    if (currentFloor !== 1) {
      baseTransitionTime += 2; // Time to change floor on the current side
      currentFloor = 1;
    }
    // Transition between sides (happens on the 1st floor)
    baseTransitionTime += 3;
    currentSide = targetSide; // Now on the target side, 1st floor
  }

  // Now on the correct side. If floors are different, change floor
  if (currentFloor !== targetFloor) {
    baseTransitionTime += 2; // Time to change floor on the target side
  }

  // Triple the base transition time
  return baseTransitionTime * 3; // TRIPLED
};

// Функция для заполнения отсутствующей информации о коридоре
const getCorridorInfo = (task: RoomTask): RoomTask => {
  // Проверяем есть ли уже номер коридора
  if (!task.corridor && task.hotelside && task.floor) {
    // Определяем коридор на основе hotelside и floor
    let corridorNumber = 0;

    // Поиск соответствующего коридора в corridorDetails
    for (const [id, details] of Object.entries(corridorDetails)) {
      const idNum = parseInt(id);

      // Особый случай для 4-го и 5-го коридоров (оба на восточной стороне, 2 этаж)
      if (task.hotelside === "east" && task.floor === 2) {
        // Если номер комнаты в диапазоне 101-109, это коридор 5, иначе 4
        if (task.room >= 101 && task.room <= 109) {
          corridorNumber = 5;
        } else {
          corridorNumber = 4;
        }
        break;
      }
      // Для остальных коридоров - просто проверяем совпадение стороны и этажа
      else if (
        details.side === task.hotelside &&
        details.floor === task.floor
      ) {
        corridorNumber = idNum;
        break;
      }
    }

    task.corridor = corridorNumber;
  }

  // Определяем наличие склада на основе номера комнаты, а не коридора
  // Это переопределит значения, полученные из JSON, если они есть
  if (task.room) {
    task.hasstorage = doesRoomHaveStorage(task.room);
  }

  return task;
};

// Форматирование времени HH:MM
const formatTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes}`;
};

// Добавление минут к дате
const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

// Добавим вспомогательную функцию для проверки, является ли имя командой
const isTeamName = (name: string): boolean => {
  return name.startsWith("Команда");
};

// Функция для получения цвета команды по ID
const getTeamColor = (id: number): string => {
  switch (id) {
    case 1:
      return "bg-blue-500 text-white"; // Team 1 - синий
    case 2:
      return "bg-purple-500 text-white"; // Team 2 - фиолетовый
    case 3:
      return "bg-green-500 text-white"; // Team 3 - зеленый
    case 4:
      return "bg-amber-500 text-white"; // Team 4 - янтарный
    case 5:
      return "bg-red-500 text-white"; // Team 5 - красный
    default:
      return "bg-gray-500 text-white"; // По умолчанию - серый
  }
};

// Функция для получения цвета сотрудника/команды для подсветки строк
const getEmployeeRowColor = (employeeName: string): string => {
  // Если это команда, получаем ID команды
  if (employeeName && employeeName.startsWith("Команда")) {
    const teamId = parseInt(employeeName.replace("Команда ", ""));

    if (!isNaN(teamId)) {
      switch (teamId) {
        case 1:
          return "bg-blue-200 hover:bg-blue-300";
        case 2:
          return "bg-purple-200 hover:bg-purple-300";
        case 3:
          return "bg-green-200 hover:bg-green-300";
        case 4:
          return "bg-amber-200 hover:bg-amber-300";
        case 5:
          return "bg-red-200 hover:bg-red-300";
      }
    }
  }

  // Генерируем цвет на основе имени сотрудника для уникальности
  // Используем 6 базовых цветов для индивидуальных сотрудников
  const nameHash = employeeName
    .split("")
    .reduce((hash, char) => char.charCodeAt(0) + hash, 0);
  const colorIndex = nameHash % 6;

  switch (colorIndex) {
    case 0:
      return "bg-sky-200 hover:bg-sky-300";
    case 1:
      return "bg-teal-200 hover:bg-teal-300";
    case 2:
      return "bg-emerald-200 hover:bg-emerald-300";
    case 3:
      return "bg-orange-200 hover:bg-orange-300";
    case 4:
      return "bg-rose-200 hover:bg-rose-300";
    case 5:
      return "bg-indigo-200 hover:bg-indigo-300";
    default:
      return "bg-gray-200 hover:bg-gray-300";
  }
};

// Функция для расчета процента комнат без склада для сотрудника/команды
const calculateNoStoragePercentage = (
  tasks: RoomTask[],
  assignedRooms: number[],
): number => {
  if (assignedRooms.length === 0) return 0;

  const assignedTasks = tasks.filter((task) =>
    assignedRooms.includes(task.room),
  );
  const noStorageTasks = assignedTasks.filter(
    (task) => task.hasstorage === false,
  );

  return Math.round((noStorageTasks.length / assignedTasks.length) * 100);
};

// Функция для получения номеров комнат, назначенных сотруднику или команде
const getAssignedRooms = (
  employeeName: string,
  assignments: AssignmentResult | null,
): number[] => {
  if (!assignments) return [];

  const assignment = assignments.assignments.find(
    (a) =>
      a.employee === employeeName ||
      (a.team_members && a.team_members.includes(employeeName)),
  );

  if (!assignment) return [];

  return assignment.tasks.map((task) => task.room);
};

// Функция для получения штрафа за неоптимальное размещение комнат
const getRoomPlacementPenalty = (
  assignment: Assignment,
  potentialRoom: number,
): number => {
  if (assignment.tasks.length === 0) return 0;

  // Получаем номера комнат текущего назначения
  const assignedRooms = assignment.tasks
    .map((task) => task.room)
    .sort((a, b) => a - b);

  // Считаем минимальное расстояние между потенциальной комнатой и любой уже назначенной комнатой
  let minDistance = Infinity;

  for (const room of assignedRooms) {
    const distance = Math.abs(room - potentialRoom);

    minDistance = Math.min(minDistance, distance);
  }

  // Штраф увеличивается с увеличением расстояния между комнатами
  // Маленькие расстояния имеют небольшой штраф
  // Если потенциальная комната смежная с одной из назначенных - штраф минимальный
  if (minDistance <= 1) return 0; // Соседняя комната - нет штрафа
  if (minDistance <= 2) return 10; // В пределах 2 комнат - небольшой штраф
  if (minDistance <= 5) return 30; // В пределах 5 комнат - средний штраф

  return 50; // Большое расстояние - значительный штраф
};

// Функция для вычисления штрафа за разделение коридора между разными командами
const getCorridorIntegrityPenalty = (
  assignments: Assignment[],
  corridorId: number,
  currentEmployeeName: string,
): number => {
  // Проверяем, кто уже работает в этом коридоре
  const teamsInCorridor = new Set<string>();

  assignments.forEach((assignment) => {
    // Пропускаем текущее назначение
    if (assignment.employee === currentEmployeeName) return;

    // Проверяем, есть ли у этого назначения задачи в указанном коридоре
    const hasTasksInCorridor = assignment.tasks.some(
      (task) => task.corridor === corridorId,
    );

    if (hasTasksInCorridor) {
      teamsInCorridor.add(assignment.employee);
    }
  });

  // Если никто еще не работает в этом коридоре, штрафа нет
  if (teamsInCorridor.size === 0) return 0;

  // Если в коридоре уже работает более одной команды, то добавление еще одной не так критично
  if (teamsInCorridor.size > 1) return 50;

  // Если в коридоре работает только одна команда, то штраф за добавление другой команды очень высокий
  return 200;
};

// Функция для подсчета количества задач в коридоре
const countTasksInCorridor = (
  tasks: CalculatedTask[],
  corridorId: number,
): number => {
  return tasks.filter((task) => task.corridor === corridorId).length;
};

// Функция для проверки, может ли команда полностью взять коридор
const canTeamHandleEntireCorridor = (
  assignment: Assignment,
  corridorId: number,
  totalTasksInCorridor: number,
): boolean => {
  // Получаем все задачи команды
  const currentTasks = assignment.tasks.length;

  // Расчет эффективности команды
  const efficiency = assignment.efficiency_factor || 1.0;

  // Оценка возможности взять весь коридор
  // Количество задач, которые команда может обработать, зависит от эффективности
  const estimatedCapacity = 10 * efficiency; // Примерно 10 задач на одного человека

  return currentTasks + totalTasksInCorridor <= estimatedCapacity;
};

// New interface for schedule data
interface ScheduleData {
  [date: string]: string[]; // Format: "DD-MM-YYYY": ["Full Name 1", "Full Name 2"]
}

// Name mapping: Full Name (schedule.json) -> Short Name (employees.json)
const nameMap: { [key: string]: string } = {
  "Kateryna Kupriienko": "Kate",
  "Dmytro Panin": "Dmitriy",
  "Tetiana Puchko": "Tatiana",
  "Svitlana Hordeieva": "Svetlana",
  "David Akopian": "Davyd",
  "Milena Tavakalian": "Milena",
  "Mikael Akopian": "Mikael",
};

// Hardcoded schedule data to avoid fetch errors
const hardcodedSchedule: ScheduleData = {
  "31-03-2025": [
    "David Akopian",
    "Kateryna Kupriienko",
    "Mikael Akopian",
    "Milena Tavakalian",
    "Svitlana Hordeieva",
  ],
  "01-04-2025": [
    "Dmytro Panin",
    "Milena Tavakalian",
    "Svitlana Hordeieva",
    "Tetiana Puchko",
  ],
  "02-04-2025": [
    "Dmytro Panin",
    "Mikael Akopian",
    "Svitlana Hordeieva",
    "Tetiana Puchko",
  ],
  "03-04-2025": [
    "David Akopian",
    "Dmytro Panin",
    "Mikael Akopian",
    "Tetiana Puchko",
  ],
  "04-04-2025": [
    "David Akopian",
    "Kateryna Kupriienko",
    "Mikael Akopian",
    "Milena Tavakalian",
    "Svitlana Hordeieva",
  ],
  "05-04-2025": [
    "David Akopian",
    "Dmytro Panin",
    "Kateryna Kupriienko",
    "Milena Tavakalian",
    "Tetiana Puchko",
  ],
};

export default function Home() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roomTasks, setRoomTasks] = useState<RoomTask[]>([]);
  const [assignments, setAssignments] = useState<AssignmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [editingCorridor, setEditingCorridor] = useState<number | null>(null);
  const [currentWorkingDayString, setCurrentWorkingDayString] =
    useState<string>(""); // State to store which day's schedule is shown

  // Load employees, tasks, and schedule on page load
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch base employee list and tasks only
        const [employeesData, roomTasksData] = await Promise.all([
          api.employees.getAllEmployees(),
          api.tasks.getRoomTasks(),
        ]);

        // Fetch schedule data from our new API endpoint
        let schedule = hardcodedSchedule; // fallback

        try {
          const scheduleResponse = await fetch(
            "http://localhost:8000/api/schedule",
          );

          if (scheduleResponse.ok) {
            const scheduleData = await scheduleResponse.json();

            if (scheduleData && Object.keys(scheduleData).length > 0) {
              schedule = scheduleData;
              console.log(
                "Successfully loaded schedule from API:",
                Object.keys(schedule).length,
                "dates available",
              );
            } else {
              console.warn(
                "Schedule from API is empty, using hardcoded schedule",
              );
            }
          } else {
            console.warn(
              "Failed to fetch schedule from API:",
              scheduleResponse.status,
            );
          }
        } catch (fetchError: unknown) {
          console.warn(
            "Error fetching schedule from API:",
            fetchError instanceof Error
              ? fetchError.message
              : String(fetchError),
          );
          console.log("Using hardcoded schedule as fallback");
        }

        const baseEmployees = employeesData.employees || [];

        // --- Determine Target Date (Today or Tomorrow after 5 PM) ---
        const now = new Date();
        const fivePM = set(now, {
          hours: 17,
          minutes: 0,
          seconds: 0,
          milliseconds: 0,
        });
        const targetDate = isAfter(now, fivePM) ? addDays(now, 1) : now;

        // Format properly for comparison with schedule.json
        const targetDateStr = format(targetDate, "dd-MM-yyyy");

        // Store the displayed date string for the header
        setCurrentWorkingDayString(format(targetDate, "EEEE, dd MMMM yyyy")); // e.g., "Monday, 31 March 2025"

        // Debug: Check what date we're looking for
        console.log("Current date:", format(now, "yyyy-MM-dd HH:mm:ss"));
        console.log("Using date key:", targetDateStr);
        console.log("Available date keys in schedule:", Object.keys(schedule));

        // --- Synchronize Employee Working Status ---
        const workingFullNames = schedule[targetDateStr] || [];

        console.log(
          "Found working people for",
          targetDateStr,
          ":",
          workingFullNames,
        );

        // Add 7th April for testing (if today is not in our dataset)
        // This is just to have some working people for testing
        if (workingFullNames.length === 0) {
          console.log(
            "No workers found for today, using test data from April 7th",
          );
          const workingFullNames07April = schedule["07-04-2025"] || [];

          // Add this data if available
          if (workingFullNames07April.length > 0) {
            console.log("Using test data instead:", workingFullNames07April);
            const workingShortNames = new Set(
              workingFullNames07April
                .map((fullName) => nameMap[fullName])
                .filter(Boolean),
            );

            const synchronizedEmployees = baseEmployees.map(
              (emp: Employee) => ({
                ...emp,
                istodayworking: workingShortNames.has(emp.name),
              }),
            );

            setEmployees(synchronizedEmployees);
            setCurrentWorkingDayString("Monday, 07 April 2025 (Test Data)");

            // Process room tasks as normal
            const tasksWithCorridors = (roomTasksData.tasks || []).map(
              getCorridorInfo,
            );

            setRoomTasks(tasksWithCorridors);

            return; // Exit early since we've set the employees
          }
        }

        const workingShortNames = new Set(
          workingFullNames.map((fullName) => nameMap[fullName]).filter(Boolean), // Convert full names to short names and filter out undefineds
        );

        // Safely convert Set to Array for logging
        const shortNamesArray = Array.from(workingShortNames);

        console.log("Working short names:", shortNamesArray);

        setEmployees(
          baseEmployees.map((emp: Employee) => ({
            ...emp,
            istodayworking: workingShortNames.has(emp.name), // Update status based on schedule and mapping
          })),
        ); // Update state with synchronized employee data

        // Process and set RoomTasks (as before)
        const tasksWithCorridors = (roomTasksData.tasks || []).map(
          getCorridorInfo,
        );

        console.log("Room tasks after getCorridorInfo:", tasksWithCorridors);
        setRoomTasks(tasksWithCorridors);
      } catch (error) {
        console.error("Error fetching data:", error);
        // Handle error - show a notification or set a default state
      }
    };

    fetchData();
  }, []); // Run once on mount

  // Функция для создания команды из выбранных сотрудников
  const createTeam = () => {
    if (selectedEmployees.length < 1) {
      alert("Выберите хотя бы одного сотрудника для создания команды");

      return;
    }

    // Проверяем, что выбранные сотрудники не входят уже в другие команды
    const alreadyInTeam = selectedEmployees.filter((name) => {
      const emp = employees.find((e) => e.name === name);

      return emp && emp.team !== undefined;
    });

    if (alreadyInTeam.length > 0) {
      alert(
        `Сотрудник(и) ${alreadyInTeam.join(", ")} уже состоит в команде. Один сотрудник не может входить в несколько команд.`,
      );

      return;
    }

    // Создаем новый ID команды
    const newTeamId =
      teams.length > 0 ? Math.max(...teams.map((t) => t.id)) + 1 : 1;

    // Создаем новую команду
    const newTeam: Team = {
      id: newTeamId,
      members: [...selectedEmployees],
    };

    // Добавляем команду в список
    setTeams([...teams, newTeam]);

    // Обновляем сотрудников с новой командой
    setEmployees((prevEmployees) =>
      prevEmployees.map((emp) =>
        selectedEmployees.includes(emp.name)
          ? { ...emp, team: newTeamId }
          : emp,
      ),
    );

    // Сбрасываем выбранных сотрудников
    setSelectedEmployees([]);

    // Сбрасываем назначения, т.к. теперь они будут неактуальны
    setAssignments(null);
  };

  // Функция для удаления команды
  const removeTeam = (teamId: number) => {
    // Удаляем команду из списка
    setTeams((prevTeams) => prevTeams.filter((team) => team.id !== teamId));

    // Обновляем сотрудников, убирая идентификатор команды
    setEmployees((prevEmployees) =>
      prevEmployees.map((emp) =>
        emp.team === teamId ? { ...emp, team: undefined } : emp,
      ),
    );

    // Сбрасываем назначения
    setAssignments(null);
  };

  // Обработчик выбора сотрудника (для формирования команды)
  const toggleEmployeeSelection = (name: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  // Проверяем, принадлежит ли сотрудник какой-либо команде
  const getEmployeeTeam = (name: string): Team | undefined => {
    return teams.find((team) => team.members.includes(name));
  };

  // Улучшенный алгоритм распределения заданий
  const handleGenerateAssignments = async () => {
    setLoading(true);
    setAssignments(null); // Сбрасываем предыдущие результаты
    await new Promise((resolve) => setTimeout(resolve, 50)); // Даем UI обновиться

    try {
      // Use the 'employees' state which already has the correct 'istodayworking' status
      const workingEmps = employees.filter((emp) => emp.istodayworking);

      if (workingEmps.length === 0) {
        // Use the date string in the alert
        alert(
          `Нет работающих сотрудников для распределения задач на ${currentWorkingDayString}.`,
        );
        setLoading(false);

        return;
      }

      if (roomTasks.length === 0) {
        alert("Нет задач для распределения.");
        setLoading(false);

        return;
      }

      // Проверяем, что у всех задач установлены необходимые атрибуты
      const tasksWithMissingData = roomTasks.filter(
        (task) => !task.type || task.corridor === undefined,
      );

      if (tasksWithMissingData.length > 0) {
        console.warn(
          "Некоторые задачи имеют неполные данные:",
          tasksWithMissingData,
        );
      }

      // Группируем сотрудников по командам
      const workingTeams: Record<string, Employee[]> = {};
      const teamEfficiencyFactor: Record<string, number> = {};

      workingEmps.forEach((emp) => {
        const teamKey = emp.team
          ? `team_${emp.team}`
          : `individual_${emp.name}`;

        if (!workingTeams[teamKey]) {
          workingTeams[teamKey] = [];
        }

        workingTeams[teamKey].push(emp);
      });

      // Рассчитываем эффективность команд
      // Используем нелинейную функцию эффективности:
      // 1 сотрудник = x1.0, 2 сотрудника = x1.8, 3 сотрудника = x2.5, 4+ сотрудника = x3.0
      Object.keys(workingTeams).forEach((teamKey) => {
        const teamSize = workingTeams[teamKey].length;

        if (teamSize === 1) {
          teamEfficiencyFactor[teamKey] = 1.0; // Один сотрудник - стандартная эффективность
        } else if (teamSize === 2) {
          teamEfficiencyFactor[teamKey] = 2.0; // Два сотрудника - эффективность x2.0
        } else if (teamSize === 3) {
          teamEfficiencyFactor[teamKey] = 3.0; // Три сотрудника - эффективность x3.0
        } else {
          teamEfficiencyFactor[teamKey] = 3.0; // Четыре и более - эффективность x3.0
        }
      });

      // 1. Подготовка задач с расчетом времени
      const preparedTasks: CalculatedTask[] = roomTasks
        .filter((task) => task.type && task.type.trim() !== "") // Игнорируем задачи без типа
        .map((task) => {
          let minutes = 0;

          // Время задачи по типу
          switch (task.type) {
            case "V/N":
              minutes = 45;
              break;
            case "V":
              minutes = 45;
              break;
            case "B":
              minutes = 15;
              break;
            case "N":
              minutes = 5;
              break;
            case "-":
              minutes = 0;
              break; // Не требует уборки
            default:
              console.warn(
                `Неизвестный тип задачи '${task.type}' для комнаты ${task.room}. Установлено время 20 мин.`,
              );
              minutes = 20;
          }
          // Добавляем время за примечание (учитываем только значимые)
          const significantNotes = [
            "дополнительная кровать",
            "установка детской кровати",
            "другое",
          ];

          if (task.note && significantNotes.includes(task.note.toLowerCase())) {
            minutes += 10;
          }

          return {
            ...task,
            estimated_time: minutes,
            // Формируем описание задачи
            description: `${getTaskTypeName(task.type)}${task.note && task.note !== "-" ? ` (${task.note})` : ""}`,
          };
        });

      if (preparedTasks.length === 0) {
        alert("Нет задач с указанным типом для распределения.");
        setLoading(false);

        return;
      }

      // Копия для манипуляций
      let remainingTasks = [...preparedTasks];

      // Группируем задачи по коридорам и сортируем по номерам комнат
      // Это необходимо для того, чтобы задачи в соседних комнатах были назначены одной и той же команде
      remainingTasks.sort((a, b) => {
        // Сначала группируем по коридорам
        if (a.corridor !== b.corridor) {
          return (a.corridor || 0) - (b.corridor || 0);
        }

        // Затем сортируем по номерам комнат внутри коридора
        return a.room - b.room;
      });

      // Предварительный анализ коридоров для оптимизации назначений
      const corridorsAnalysis: Record<
        number,
        { totalTasks: number; assignedTo?: number }
      > = {};

      // Считаем количество задач в каждом коридоре
      remainingTasks.forEach((task) => {
        if (task.corridor !== undefined) {
          if (!corridorsAnalysis[task.corridor]) {
            corridorsAnalysis[task.corridor] = { totalTasks: 0 };
          }
          corridorsAnalysis[task.corridor].totalTasks++;
        }
      });

      console.log("Анализ коридоров:", corridorsAnalysis);

      // 2. Инициализация назначений для команд
      const currentAssignments: Assignment[] = Object.keys(workingTeams).map(
        (teamKey) => {
          const teamMembers = workingTeams[teamKey];
          // Имя для отображения: имя сотрудника или Команда X (участники)
          const displayName =
            teamMembers.length === 1
              ? teamMembers[0].name
              : `Команда ${teamKey.replace("team_", "")} (${teamMembers.map((e) => e.name).join(", ")})`;

          // Ключевое имя для идентификации (может быть имя сотрудника или Команда X)
          const assignmentIdentifier =
            teamMembers.length === 1
              ? teamMembers[0].name
              : `Команда ${teamKey.replace("team_", "")}`;

          return {
            employee: assignmentIdentifier, // Используем идентификатор
            team_members: teamMembers.map((e) => e.name),
            team_size: teamMembers.length,
            efficiency_factor: teamEfficiencyFactor[teamKey],
            tasks: [],
            total_task_time: 0,
            total_transition_time: 0,
            total_time_before_break: 0,
            break_time_added: 0,
            total_effective_time: 0,
            needs_trolley: false,
            is_overtime: false,
            estimated_finish_time_str: "09:00", // Начальное время старта
          };
        },
      );

      // Определяем, мало ли работы (Исключение из правил по коридорам)
      const numberOfAssignees = currentAssignments.length;
      const isLittleWork = preparedTasks.length <= numberOfAssignees * 5; // Порог: 5 задач на команду/сотрудника

      console.log(
        `Is it little work? ${isLittleWork} (Tasks: ${preparedTasks.length}, Assignees: ${numberOfAssignees})`,
      );

      // 3. Цикл распределения задач
      while (remainingTasks.length > 0) {
        let bestChoice = {
          assignmentIndex: -1,
          taskIndex: -1,
          minWeightedCost: Infinity,
          // Добавляем текущую загрузку для балансировки при равенстве стоимости
          assigneeCurrentLoad: Infinity,
        };

        // Итерация по всем текущим назначениям (командам/сотрудникам)
        for (
          let assignmentIndex = 0;
          assignmentIndex < currentAssignments.length;
          assignmentIndex++
        ) {
          const assignment = currentAssignments[assignmentIndex];
          const lastTask =
            assignment.tasks.length > 0
              ? assignment.tasks[assignment.tasks.length - 1]
              : null;
          const lastCorridor = lastTask?.corridor;

          // Считаем текущие уникальные коридоры для этого назначения
          const currentCorridors = new Set(
            assignment.tasks
              .map((t) => t.corridor)
              .filter((c) => c !== undefined),
          );
          const currentCorridorCount = currentCorridors.size;

          // Определяем лимит коридоров для этого назначения
          const maxCorridors =
            assignment.team_size === 1 ? 2 : assignment.team_size === 2 ? 4 : 6;

          // Итерация по всем оставшимся задачам
          for (
            let taskIndex = 0;
            taskIndex < remainingTasks.length;
            taskIndex++
          ) {
            const potentialTask = remainingTasks[taskIndex];
            const potentialCorridor = potentialTask.corridor;

            // Пропускаем задачи без коридора (не можем рассчитать переход)
            if (potentialCorridor === undefined) {
              // console.warn(`Task for room ${potentialTask.room} skipped due to missing corridor info.`);
              continue;
            }

            // --- Проверка на лимит коридоров (если не "мало работы") ---
            const isNewCorridor = !currentCorridors.has(potentialCorridor);

            if (
              !isLittleWork &&
              isNewCorridor &&
              currentCorridorCount >= maxCorridors
            ) {
              // Если это новый коридор и лимит уже достигнут - пропускаем эту задачу для этого назначения
              continue;
            }
            // --- Конец проверки лимита коридоров ---

            // Рассчитываем время перехода от последнего задания к потенциальному
            const transitionTime = getTransitionTime(
              lastCorridor,
              potentialCorridor,
            );

            // Корректируем время задачи с учетом эффективности команды
            const teamAdjustedTaskTime =
              potentialTask.estimated_time /
              (assignment.efficiency_factor || 1.0);

            // Увеличение общего времени при добавлении этой задачи
            const costIncrease = transitionTime + teamAdjustedTaskTime;
            // Потенциальное новое общее время для этого назначения
            const potentialNewTotalTime =
              assignment.total_effective_time + costIncrease;

            // Штраф за переход (чтобы стимулировать работу в одном коридоре)
            const dynamicPenalty = transitionTime > 0 ? transitionTime * 15 : 0; // Увеличенный штраф

            // Штраф за неоптимальное размещение комнат (чтобы стимулировать работу в соседних комнатах)
            const roomPlacementPenalty = getRoomPlacementPenalty(
              assignment,
              potentialTask.room,
            );

            // Штраф за нарушение целостности коридора
            let corridorIntegrityPenalty = 0;

            if (potentialTask.corridor !== undefined) {
              corridorIntegrityPenalty = getCorridorIntegrityPenalty(
                currentAssignments,
                potentialTask.corridor,
                assignment.employee,
              );
            }

            // Взвешенная стоимость с учетом всех факторов
            const weightedCost =
              potentialNewTotalTime +
              dynamicPenalty +
              roomPlacementPenalty +
              corridorIntegrityPenalty;

            // --- Логика выбора лучшего варианта с учетом балансировки ---
            const currentAssigneeLoad = assignment.total_effective_time;

            if (
              weightedCost < bestChoice.minWeightedCost ||
              // При равенстве стоимости - выбираем того, кто менее загружен сейчас
              (weightedCost === bestChoice.minWeightedCost &&
                currentAssigneeLoad < bestChoice.assigneeCurrentLoad)
            ) {
              bestChoice = {
                assignmentIndex: assignmentIndex,
                taskIndex: taskIndex,
                minWeightedCost: weightedCost,
                assigneeCurrentLoad: currentAssigneeLoad, // Сохраняем текущую загрузку для сравнения
              };
            }
            // --- Конец логики выбора ---
          }
        }

        // --- Fallback Mechanism ---
        // Если не удалось найти задачу из-за ограничений
        if (bestChoice.assignmentIndex === -1 && remainingTasks.length > 0) {
          console.warn(
            "Primary assignment failed (constraints?). Trying fallback: assign least costly task to least busy assignee, ignoring corridor limits.",
          );

          let fallbackChoice = {
            assignmentIndex: -1,
            taskIndex: -1,
            minCostIncrease: Infinity,
          };

          // 1. Найти наименее загруженного
          let leastBusyAssigneeIndex = 0;
          let minLoad = Infinity;

          for (let i = 0; i < currentAssignments.length; i++) {
            if (currentAssignments[i].total_effective_time < minLoad) {
              minLoad = currentAssignments[i].total_effective_time;
              leastBusyAssigneeIndex = i;
            }
          }

          const targetAssignmentForFallback =
            currentAssignments[leastBusyAssigneeIndex];
          const lastTaskForFallback =
            targetAssignmentForFallback.tasks.length > 0
              ? targetAssignmentForFallback.tasks[
                  targetAssignmentForFallback.tasks.length - 1
                ]
              : null;
          const lastCorridorForFallback = lastTaskForFallback?.corridor;

          // 2. Найти задачу, добавляющую минимум времени этому сотруднику (игнорируя лимит коридоров)
          for (
            let taskIndex = 0;
            taskIndex < remainingTasks.length;
            taskIndex++
          ) {
            const potentialTask = remainingTasks[taskIndex];
            const potentialCorridor = potentialTask.corridor;

            if (potentialCorridor === undefined) continue; // Все еще пропускаем задачи без коридора

            const transitionTime = getTransitionTime(
              lastCorridorForFallback,
              potentialCorridor,
            );
            const teamAdjustedTaskTime =
              potentialTask.estimated_time /
              (targetAssignmentForFallback.efficiency_factor || 1.0);
            const costIncrease = transitionTime + teamAdjustedTaskTime;

            if (costIncrease < fallbackChoice.minCostIncrease) {
              fallbackChoice = {
                assignmentIndex: leastBusyAssigneeIndex,
                taskIndex: taskIndex,
                minCostIncrease: costIncrease,
              };
            }
          }

          // 3. Если fallback нашел задачу, используем ее
          if (
            fallbackChoice.assignmentIndex !== -1 &&
            fallbackChoice.taskIndex !== -1 &&
            fallbackChoice.taskIndex < remainingTasks.length
          ) {
            console.log(
              `Fallback successful: Assigning task ${remainingTasks[fallbackChoice.taskIndex].room} to assignee ${currentAssignments[fallbackChoice.assignmentIndex].employee}`,
            );
            bestChoice = {
              // Перезаписываем bestChoice результатом fallback
              assignmentIndex: fallbackChoice.assignmentIndex,
              taskIndex: fallbackChoice.taskIndex,
              minWeightedCost: -1, // Условное значение, показывающее fallback
              assigneeCurrentLoad:
                currentAssignments[fallbackChoice.assignmentIndex]
                  .total_effective_time,
            };
          } else {
            // Если и fallback не нашел подходящую задачу
            console.error(
              "Assignment Error: Fallback also failed. Cannot assign remaining tasks.",
              remainingTasks,
            );
            alert(
              "Ошибка распределения. Не удалось найти подходящую задачу для назначения. Возможно, ограничения по коридорам слишком строгие или задания некорректны.",
            );
            break; // Прерываем цикл
          }
        } else if (
          bestChoice.assignmentIndex === -1 &&
          remainingTasks.length === 0
        ) {
          // Цикл завершился успешно, задач не осталось
        } else if (bestChoice.assignmentIndex === -1) {
          // Не должно произойти, если fallback отработал, но на всякий случай
          console.error(
            "Assignment Error: No task chosen and fallback didn't run or failed silently.",
          );
          alert("Непредвиденная ошибка в цикле распределения.");
          break;
        }
        // --- End Fallback Mechanism ---

        // --- Назначение выбранной задачи ---
        // Проверяем еще раз, что задача была выбрана (основным или fallback методом)
        if (bestChoice.assignmentIndex !== -1) {
          try {
            // Проверяем, что индекс задачи корректный
            if (
              bestChoice.taskIndex < 0 ||
              bestChoice.taskIndex >= remainingTasks.length
            ) {
              throw new Error(
                `Invalid task index: ${bestChoice.taskIndex}, available tasks: ${remainingTasks.length}`,
              );
            }

            const assignedTaskData = remainingTasks.splice(
              bestChoice.taskIndex,
              1,
            )[0];

            // Проверяем, что назначение существует
            if (
              bestChoice.assignmentIndex < 0 ||
              bestChoice.assignmentIndex >= currentAssignments.length
            ) {
              throw new Error(
                `Invalid assignment index: ${bestChoice.assignmentIndex}, available assignments: ${currentAssignments.length}`,
              );
            }

            const targetAssignment =
              currentAssignments[bestChoice.assignmentIndex];

            // Пересчитываем фактическое время перехода для добавления к total_transition_time
            const lastAssignedTask =
              targetAssignment.tasks.length > 0
                ? targetAssignment.tasks[targetAssignment.tasks.length - 1]
                : null;
            const actualTransitionTime = getTransitionTime(
              lastAssignedTask?.corridor,
              assignedTaskData.corridor,
            );

            // Корректируем время задачи с учетом эффективности команды
            const teamAdjustedTaskTime =
              assignedTaskData.estimated_time /
              (targetAssignment.efficiency_factor || 1.0);

            // Обновляем назначение команды
            targetAssignment.tasks.push({
              room: assignedTaskData.room,
              description: assignedTaskData.description,
              estimated_time: teamAdjustedTaskTime, // Используем скорректированное время
              raw_estimated_time: assignedTaskData.estimated_time, // Сохраняем исходное время для отображения
              corridor: assignedTaskData.corridor,
            });

            targetAssignment.total_task_time += teamAdjustedTaskTime;
            targetAssignment.total_transition_time += actualTransitionTime;

            // Пересчет общего времени и добавление перерыва
            const timeBeforeBreak =
              targetAssignment.total_task_time +
              targetAssignment.total_transition_time;

            targetAssignment.total_time_before_break = timeBeforeBreak;

            // Перерыв добавляется ОДИН раз, когда время работы достигает 10:45 (105 минут)
            if (
              timeBeforeBreak > 105 &&
              targetAssignment.break_time_added === 0
            ) {
              targetAssignment.break_time_added = 15;
            }

            // Общее эффективное время = задачи + переходы + перерыв (если добавлен)
            targetAssignment.total_effective_time =
              timeBeforeBreak + targetAssignment.break_time_added;
          } catch (error) {
            console.error("Ошибка при назначении задачи:", error);
            alert(
              `Произошла ошибка при назначении задачи: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
            );
            break;
          }
        } else {
          // Сюда попадаем, если цикл должен прерваться (ошибка уже показана)
          console.log(
            "Assignment loop finished, possibly prematurely due to errors.",
          );
          // Можно не прерывать явно, т.к. while(remainingTasks.length > 0) сам остановится
        }
        // --- Конец назначения задачи ---
      }

      // 4.5. Балансировка нагрузки для выравнивания времени окончания
      console.log(
        "Запуск балансировки нагрузки для выравнивания времени окончания...",
      );

      // Определяем коридоры с кладовками
      // const corridorsWithStorage = [1, 3, 6]; // Defined earlier in doesRoomHaveStorage logic

      // Целевое время окончания (15:00 = 9:00 + 360 минут)
      const targetEndTime = 360; // в минутах от начала рабочего дня (9:00)

      // Функция пересчета времени для назначения
      const recalculateAssignment = (assignment: Assignment): void => {
        // Проверка на null/undefined
        if (!assignment || !assignment.tasks) {
          console.error(
            "Invalid assignment in recalculateAssignment",
            assignment,
          );

          return;
        }

        // Пересчитываем время задач и переходов
        let totalTaskTime = 0;
        let totalTransitionTime = 0;

        // Проверка на пустой массив задач
        if (assignment.tasks.length === 0) {
          assignment.total_task_time = 0;
          assignment.total_transition_time = 0;
          assignment.total_time_before_break = 0;
          assignment.break_time_added = 0;
          assignment.total_effective_time = 0;
          assignment.estimated_finish_time_str = "09:00";
          assignment.is_overtime = false;
          assignment.needs_trolley = false;

          return;
        }

        // Сортируем задачи по коридорам для оптимизации переходов
        assignment.tasks.sort(
          (a: AssignedTask, b: AssignedTask) =>
            (a.corridor !== undefined ? a.corridor : 0) -
            (b.corridor !== undefined ? b.corridor : 0),
        );

        // Обходим все задачи и считаем время
        for (let i = 0; i < assignment.tasks.length; i++) {
          let taskTime = assignment.tasks[i].estimated_time;

          totalTaskTime += taskTime;

          if (i > 0) {
            totalTransitionTime += getTransitionTime(
              assignment.tasks[i - 1].corridor,
              assignment.tasks[i].corridor,
            );
          }
        }

        assignment.total_task_time = totalTaskTime;
        assignment.total_transition_time = totalTransitionTime;

        // Обновляем время до перерыва
        const timeBeforeBreak = totalTaskTime + totalTransitionTime;

        assignment.total_time_before_break = timeBeforeBreak;

        // Обновляем перерыв (15 минут, если работа длится дольше 10:45)
        if (timeBeforeBreak > 105 && assignment.break_time_added === 0) {
          assignment.break_time_added = 15;
        } else if (timeBeforeBreak <= 105) {
          assignment.break_time_added = 0;
        }

        // Обновляем общее время
        assignment.total_effective_time =
          timeBeforeBreak + assignment.break_time_added;

        // Обновляем время окончания
        const startTime = new Date();

        startTime.setHours(9, 0, 0, 0);
        const finishTime = addMinutes(
          startTime,
          assignment.total_effective_time,
        );

        assignment.estimated_finish_time_str = formatTime(finishTime);

        // Обновляем флаги
        const availableWorkTime = 360; // Changed from 345 to 360 (finish at 15:00)

        assignment.is_overtime =
          assignment.total_effective_time > availableWorkTime;
        // Logic for needs_trolley is handled later in limitTrolleys
        // assignment.needs_trolley = assignment.tasks.some(
        //   (task: AssignedTask) => task.corridor !== undefined && !doesRoomHaveStorage(task.room) // Use room number check
        // );
      };

      // Определяем количество сотрудников в каждом коридоре
      const countEmployeesPerCorridor = () => {
        const corridorCounts: Record<number, Set<string>> = {};

        // Подсчитываем количество сотрудников, работающих в каждом коридоре
        currentAssignments.forEach((assignment) => {
          assignment.tasks.forEach((task) => {
            if (task.corridor !== undefined) {
              if (!corridorCounts[task.corridor]) {
                corridorCounts[task.corridor] = new Set();
              }
              corridorCounts[task.corridor].add(assignment.employee);
            }
          });
        });

        return corridorCounts;
      };

      // Находим коридоры с наибольшим количеством задач
      const countTasksPerCorridor = () => {
        const taskCounts: Record<number, number> = {};

        remainingTasks.forEach((task) => {
          if (task.corridor !== undefined) {
            if (!taskCounts[task.corridor]) {
              taskCounts[task.corridor] = 0;
            }
            taskCounts[task.corridor]++;
          }
        });

        currentAssignments.forEach((assignment) => {
          assignment.tasks.forEach((task) => {
            if (task.corridor !== undefined) {
              if (!taskCounts[task.corridor]) {
                taskCounts[task.corridor] = 0;
              }
              taskCounts[task.corridor]++;
            }
          });
        });

        return taskCounts;
      };

      // Перемещает конкретную задачу от одного назначения к другому
      const moveTaskBetweenAssignments = (
        sourceAssignment: Assignment,
        targetAssignment: Assignment,
        taskIndex: number,
        corridorCounts: Record<number, Set<string>>,
      ) => {
        try {
          const task = sourceAssignment.tasks[taskIndex];

          // Обновляем счетчики сотрудников по коридорам
          if (task.corridor !== undefined) {
            if (corridorCounts[task.corridor]) {
              // Удаляем исходного сотрудника из коридора, если у него больше нет задач в этом коридоре
              const remainingTasksInCorridor = sourceAssignment.tasks.filter(
                (t, idx) => idx !== taskIndex && t.corridor === task.corridor,
              );

              if (remainingTasksInCorridor.length === 0) {
                corridorCounts[task.corridor].delete(sourceAssignment.employee);
              }

              // Добавляем целевого сотрудника в коридор
              corridorCounts[task.corridor].add(targetAssignment.employee);
            }
          }

          // Подготавливаем задачу с учетом эффективности
          const sourceEfficiency = sourceAssignment.efficiency_factor || 1.0;
          const targetEfficiency = targetAssignment.efficiency_factor || 1.0;
          const rawTime =
            task.raw_estimated_time || task.estimated_time * sourceEfficiency;

          // Копируем задачу с учетом новой эффективности
          const taskCopy = {
            ...task,
            estimated_time: rawTime / targetEfficiency,
            raw_estimated_time: rawTime,
          };

          // Перемещаем задачу
          sourceAssignment.tasks.splice(taskIndex, 1);
          targetAssignment.tasks.push(taskCopy);

          // Пересчитываем время для обоих назначений
          recalculateAssignment(sourceAssignment);
          recalculateAssignment(targetAssignment);

          console.log(
            `Перемещена задача: Комната ${task.room} от ${sourceAssignment.employee} к ${targetAssignment.employee}`,
          );
          console.log(
            `Новое время: ${sourceAssignment.employee}: ${sourceAssignment.total_effective_time.toFixed(1)} мин, ${targetAssignment.employee}: ${targetAssignment.total_effective_time.toFixed(1)} мин`,
          );
        } catch (error) {
          console.error("Ошибка при перемещении задачи:", error);
          console.log(
            `Не удалось переместить задачу от ${sourceAssignment.employee} к ${targetAssignment.employee}`,
          );
        }
      };

      // Считаем дисбаланс как стандартное отклонение от целевого времени окончания
      const calculateImbalance = (times: number[]): number => {
        // Считаем квадрат отклонения от целевого времени для каждого сотрудника
        // и берем среднее значение
        return (
          times.reduce(
            (sum, time) => sum + Math.pow(time - targetEndTime, 2),
            0,
          ) / times.length
        );
      };

      // Считаем максимальное отклонение между назначениями
      const calculateMaxDeviation = (assignments: Assignment[]): number => {
        const times = assignments.map((a) => a.total_effective_time);
        const max = Math.max(...times);
        const min = Math.min(...times);

        return max - min;
      };

      // Фаза 1: Обычная балансировка с ограничениями на коридоры
      console.log("Фаза 1: Стандартная балансировка нагрузки...");
      // Выполнение балансировки (максимум 15 итераций)
      for (let iteration = 0; iteration < 15; iteration++) {
        // Найти самого загруженного и наименее загруженного сотрудника
        let maxTime = -1,
          minTime = Infinity;
        let maxIndex = -1,
          minIndex = -1;

        for (let i = 0; i < currentAssignments.length; i++) {
          const time = currentAssignments[i].total_effective_time;

          if (time > maxTime) {
            maxTime = time;
            maxIndex = i;
          }
          if (time < minTime) {
            minTime = time;
            minIndex = i;
          }
        }

        // Вычисляем максимальную допустимую разницу между сотрудниками (15 минут)
        // Если целевое время окончания задано, стараемся приблизить всех к этому времени
        const timeDifference = maxTime - minTime;

        // Проверяем, что у нас еще есть значительная разница между сотрудниками
        // Уменьшаем порог до 10 минут для более точной балансировки
        if (timeDifference <= 10 || maxIndex === minIndex) {
          console.log(
            `Стандартная балансировка завершена после ${iteration} итераций. Разница: ${timeDifference.toFixed(1)} мин.`,
          );
          break;
        }

        // Источник и получатель задач
        const sourceAssignment = currentAssignments[maxIndex];
        const targetAssignment = currentAssignments[minIndex];

        // Если у источника только одна задача, не можем перемещать
        if (sourceAssignment.tasks.length <= 1) {
          console.log(
            `Невозможно балансировать: ${sourceAssignment.employee} имеет только ${sourceAssignment.tasks.length} задачу.`,
          );
          // Продолжаем цикл, возможно есть другие сотрудники с достаточным количеством задач
          continue;
        }

        // Проверка ограничений по коридорам с учетом того, что не более 2 сотрудников на коридор
        const corridorCounts = countEmployeesPerCorridor();
        const targetCorridors = new Set(
          targetAssignment.tasks
            .map((t) => t.corridor)
            .filter((c) => c !== undefined),
        );

        // Максимальное количество коридоров для команды осталось прежним
        const maxCorridors =
          targetAssignment.team_size === 1
            ? 2
            : targetAssignment.team_size === 2
              ? 4
              : 6;

        // Ищем наилучшую задачу для перемещения
        let bestTaskIndex = -1;
        let bestImprovement = -1;

        // Сортируем задачи по времени (большие сначала), чтобы перемещать самые времязатратные задачи
        const sortedTasks = [...sourceAssignment.tasks].sort(
          (a, b) => b.estimated_time - a.estimated_time,
        );

        for (let i = 0; i < sortedTasks.length; i++) {
          const task = sortedTasks[i];
          const originalIndex = sourceAssignment.tasks.findIndex(
            (t) => t.room === task.room,
          );

          if (task.corridor === undefined) continue;

          // Проверка на превышение лимита коридоров для получателя
          if (
            !targetCorridors.has(task.corridor) &&
            targetCorridors.size >= maxCorridors
          ) {
            continue;
          }

          // Проверка, что в коридоре не будет более 2 сотрудников после перемещения
          if (
            corridorCounts[task.corridor] &&
            !targetCorridors.has(task.corridor) &&
            corridorCounts[task.corridor].size >= 2
          ) {
            // Уже 2 или более сотрудников в этом коридоре, и целевой сотрудник еще не работает в нем
            continue;
          }

          // Эффективность команд влияет на время задачи
          const sourceEfficiency = sourceAssignment.efficiency_factor || 1.0;
          const targetEfficiency = targetAssignment.efficiency_factor || 1.0;
          const rawTime =
            task.raw_estimated_time || task.estimated_time * sourceEfficiency;
          const newEstimatedTime = rawTime / targetEfficiency;

          // Моделируем перенос задачи
          const sourceTasksCopy = [...sourceAssignment.tasks];

          sourceTasksCopy.splice(originalIndex, 1);

          const targetTasksCopy = [...targetAssignment.tasks];

          targetTasksCopy.push({
            ...task,
            estimated_time: newEstimatedTime,
            raw_estimated_time: rawTime,
          });

          // Создаем временные копии назначений
          const sourceCopy = { ...sourceAssignment, tasks: sourceTasksCopy };
          const targetCopy = { ...targetAssignment, tasks: targetTasksCopy };

          // Пересчитываем время
          recalculateAssignment(sourceCopy);
          recalculateAssignment(targetCopy);

          // Вычисляем штраф за неоптимальное размещение комнат для целевого назначения после добавления задачи
          const roomPlacementPenaltyAfterMove = getRoomPlacementPenalty(
            targetCopy,
            task.room,
          );

          // Вычисляем штраф за нарушение целостности коридора
          let corridorIntegrityPenaltyAfterMove = 0;

          if (task.corridor !== undefined) {
            // Проверяем, работает ли кто-то еще в этом коридоре
            const otherTeamsInCorridor = new Set<string>();

            currentAssignments.forEach((a) => {
              if (
                a.employee !== sourceAssignment.employee &&
                a.employee !== targetAssignment.employee
              ) {
                const hasTasksInCorridor = a.tasks.some(
                  (t) => t.corridor === task.corridor,
                );

                if (hasTasksInCorridor) {
                  otherTeamsInCorridor.add(a.employee);
                }
              }
            });

            // Если в коридоре уже работают другие команды, то перенос одной задачи не так критичен
            // Если же в коридоре работает только одна команда, то штраф за перенос одной задачи в другую команду высокий
            if (otherTeamsInCorridor.size === 0) {
              // Считаем сколько задач останется у исходной команды в этом коридоре
              const remainingTasksInCorridor = sourceCopy.tasks.filter(
                (t) => t.corridor === task.corridor,
              ).length;

              if (remainingTasksInCorridor === 0) {
                // Если это последняя задача из коридора, то штрафа нет - мы полностью передаём коридор
                corridorIntegrityPenaltyAfterMove = 0;
              } else {
                // Если в коридоре остаются задачи у исходной команды, то мы разбиваем коридор - высокий штраф
                corridorIntegrityPenaltyAfterMove = 150;
              }
            }
          }

          // Определяем новые времена для всех назначений после перемещения задачи
          const newTimesAfterMoving = currentAssignments.map(
            (a: Assignment, idx: number): number =>
              idx === maxIndex
                ? sourceCopy.total_effective_time
                : idx === minIndex
                  ? targetCopy.total_effective_time
                  : a.total_effective_time,
          );

          // Вычисляем новую разницу между максимальным и минимальным временем
          const newMax = Math.max(...newTimesAfterMoving);
          const newMin = Math.min(...newTimesAfterMoving);

          // Текущий дисбаланс времен окончания
          const currentImbalance = calculateImbalance(
            currentAssignments.map((a) => a.total_effective_time),
          );

          // Новый дисбаланс после перемещения задачи
          const newImbalance = calculateImbalance(newTimesAfterMoving);

          // Улучшение теперь учитывает как уменьшение разницы между макс. и мин. временем,
          // так и приближение всех сотрудников к целевому времени окончания,
          // и штраф за неоптимальное размещение комнат
          const basicImprovement = maxTime - minTime - (newMax - newMin);
          const imbalanceImprovement = currentImbalance - newImbalance;

          // Общее улучшение с учетом штрафа за размещение комнат и целостности коридора
          const totalImprovement =
            basicImprovement +
            imbalanceImprovement -
            roomPlacementPenaltyAfterMove * 0.2 -
            corridorIntegrityPenaltyAfterMove * 0.8;

          // Если перемещение улучшает баланс, запоминаем задачу
          if (totalImprovement > bestImprovement) {
            bestImprovement = totalImprovement;
            bestTaskIndex = originalIndex;
          }
        }

        // Если нашли подходящую задачу, перемещаем её
        if (bestTaskIndex !== -1) {
          moveTaskBetweenAssignments(
            sourceAssignment,
            targetAssignment,
            bestTaskIndex,
            corridorCounts,
          );
        } else {
          console.log(
            `Не найдено подходящей задачи для перемещения при текущих ограничениях.`,
          );
          // Если не нашли задач для перемещения, завершаем первую фазу
          break;
        }
      }

      // Фаза 2: Агрессивная балансировка с временным послаблением ограничений
      // Запускаем только если дисбаланс всё еще слишком большой
      const currentDeviation = calculateMaxDeviation(currentAssignments);

      if (currentDeviation > 30) {
        console.log(
          `Фаза 2: Агрессивная балансировка. Текущая разница: ${currentDeviation.toFixed(1)} мин.`,
        );

        // Дополнительные итерации балансировки с временным послаблением ограничений
        for (let iteration = 0; iteration < 10; iteration++) {
          // Найти самого загруженного и наименее загруженного сотрудника
          const assignmentsByTime = [...currentAssignments].sort(
            (a, b) => b.total_effective_time - a.total_effective_time,
          );

          // Берем самого загруженного для источника
          const sourceAssignment = assignmentsByTime[0];

          // И наименее загруженного для получателя
          const targetAssignment =
            assignmentsByTime[assignmentsByTime.length - 1];

          const timeDifference =
            sourceAssignment.total_effective_time -
            targetAssignment.total_effective_time;

          // Завершаем, если разница меньше порога или если это один и тот же сотрудник
          if (
            timeDifference <= 15 ||
            sourceAssignment.employee === targetAssignment.employee
          ) {
            console.log(
              `Агрессивная балансировка завершена после ${iteration} итераций. Разница: ${timeDifference.toFixed(1)} мин.`,
            );
            break;
          }

          console.log(
            `Итерация ${iteration}: Разница между ${sourceAssignment.employee} и ${targetAssignment.employee}: ${timeDifference.toFixed(1)} мин.`,
          );

          // Убедимся, что у источника есть задачи для перемещения
          if (sourceAssignment.tasks.length <= 1) {
            console.log(
              `Сотрудник ${sourceAssignment.employee} имеет только ${sourceAssignment.tasks.length} задач, пропускаем.`,
            );
            // Убираем из списка для следующей итерации
            assignmentsByTime.shift();
            if (assignmentsByTime.length < 2) break;
            continue;
          }

          const corridorCounts = countEmployeesPerCorridor();
          const targetCorridors = new Set(
            targetAssignment.tasks
              .map((t) => t.corridor)
              .filter((c) => c !== undefined),
          );

          // Задаем более мягкое ограничение на коридоры для этой фазы
          const maxCorridors =
            targetAssignment.team_size === 1
              ? 3
              : targetAssignment.team_size === 2
                ? 5
                : 7;

          // Ищем лучшую задачу с учетом временных послаблений
          let bestTaskIndex = -1;
          let bestBalanceImprovement = -1;

          // Анализируем задачи источника, сортируя их по размеру (большие сначала)
          const sortedTasks = [...sourceAssignment.tasks].sort(
            (a, b) => b.estimated_time - a.estimated_time,
          );

          for (let i = 0; i < sortedTasks.length; i++) {
            const task = sortedTasks[i];

            // Находим оригинальный индекс
            const originalIndex = sourceAssignment.tasks.findIndex(
              (t) => t.room === task.room,
            );

            // Определяем коридор задачи
            if (task.corridor === undefined) continue;

            // Проверка на превышение лимита коридоров
            // В агрессивной фазе мы увеличиваем лимит
            if (
              !targetCorridors.has(task.corridor) &&
              targetCorridors.size >= maxCorridors
            ) {
              continue;
            }

            // В агрессивной фазе мы позволяем иметь до 3 сотрудников в коридоре,
            // но только для коридоров с большим числом задач
            const isHighVolumeTask = task.estimated_time > 30; // Длительные задачи

            // Проверка на максимальное число сотрудников в коридоре
            // Если это коридор с большим объемом работы или если целевой сотрудник
            // уже работает в этом коридоре - можем добавить еще одного
            const maxEmployeesPerCorridor =
              isHighVolumeTask || targetCorridors.has(task.corridor) ? 3 : 2;

            if (
              corridorCounts[task.corridor] &&
              !targetCorridors.has(task.corridor) &&
              corridorCounts[task.corridor].size >= maxEmployeesPerCorridor
            ) {
              continue;
            }

            // Эффективность команд влияет на время задачи
            const sourceEfficiency = sourceAssignment.efficiency_factor || 1.0;
            const targetEfficiency = targetAssignment.efficiency_factor || 1.0;
            const rawTime =
              task.raw_estimated_time || task.estimated_time * sourceEfficiency;
            const newEstimatedTime = rawTime / targetEfficiency;

            // Моделируем перенос задачи
            const sourceTasksCopy = [...sourceAssignment.tasks];

            sourceTasksCopy.splice(originalIndex, 1);

            const targetTasksCopy = [...targetAssignment.tasks];

            targetTasksCopy.push({
              ...task,
              estimated_time: newEstimatedTime,
              raw_estimated_time: rawTime,
            });

            // Создаем временные копии назначений
            const sourceCopy = { ...sourceAssignment, tasks: sourceTasksCopy };
            const targetCopy = { ...targetAssignment, tasks: targetTasksCopy };

            // Пересчитываем время
            recalculateAssignment(sourceCopy);
            recalculateAssignment(targetCopy);

            // Вычисляем улучшение баланса времени
            const oldDifference =
              sourceAssignment.total_effective_time -
              targetAssignment.total_effective_time;
            const newDifference =
              sourceCopy.total_effective_time - targetCopy.total_effective_time;

            // Улучшение - это насколько мы уменьшили разницу
            const improvement = oldDifference - Math.abs(newDifference);

            // Учитываем дополнительно приближение к целевому времени
            // Идеально, если обе команды близки к targetEndTime
            const oldDistanceFromTarget =
              Math.abs(sourceAssignment.total_effective_time - targetEndTime) +
              Math.abs(targetAssignment.total_effective_time - targetEndTime);

            const newDistanceFromTarget =
              Math.abs(sourceCopy.total_effective_time - targetEndTime) +
              Math.abs(targetCopy.total_effective_time - targetEndTime);

            const targetImprovement =
              oldDistanceFromTarget - newDistanceFromTarget;

            // Взвешенное улучшение
            const balanceImprovement = improvement + targetImprovement * 0.5;

            if (balanceImprovement > bestBalanceImprovement) {
              bestBalanceImprovement = balanceImprovement;
              bestTaskIndex = originalIndex;
            }
          }

          // Если нашли подходящую задачу, перемещаем её
          if (bestTaskIndex !== -1) {
            moveTaskBetweenAssignments(
              sourceAssignment,
              targetAssignment,
              bestTaskIndex,
              corridorCounts,
            );
          } else {
            console.log(
              `Не найдено подходящей задачи для перемещения даже с послаблениями. Пробуем другой источник.`,
            );
            // Убираем из списка для следующей итерации
            assignmentsByTime.shift();
            if (assignmentsByTime.length < 2) break;
          }
        }
      }

      // Фаза 3: Финальная проверка и корректировка
      console.log("Фаза 3: Финальная корректировка...");

      // Получаем окончательные назначения, отсортированные по времени
      const finalAssignments = [...currentAssignments].sort(
        (a, b) => b.total_effective_time - a.total_effective_time,
      );

      // Если разница между первым и последним всё ещё существенная (>30 мин),
      // пытаемся перебросить одну последнюю задачу без ограничений
      const finalDeviation =
        finalAssignments[0].total_effective_time -
        finalAssignments[finalAssignments.length - 1].total_effective_time;

      if (finalDeviation > 30 && finalAssignments[0].tasks.length > 1) {
        console.log(
          `Финальная разница все еще ${finalDeviation.toFixed(1)} минут. Пробуем последнюю корректировку.`,
        );

        const sourceAssignment = finalAssignments[0];
        const targetAssignment = finalAssignments[finalAssignments.length - 1];

        // Находим задачу, после перемещения которой разница будет минимальной
        let bestTaskIndex = -1;
        let bestFinalDifference = finalDeviation;

        for (let i = 0; i < sourceAssignment.tasks.length; i++) {
          const task = sourceAssignment.tasks[i];

          // Эффективность команд влияет на время задачи
          const sourceEfficiency = sourceAssignment.efficiency_factor || 1.0;
          const targetEfficiency = targetAssignment.efficiency_factor || 1.0;
          const rawTime =
            task.raw_estimated_time || task.estimated_time * sourceEfficiency;
          const newEstimatedTime = rawTime / targetEfficiency;

          // Моделируем перенос задачи
          const sourceTasksCopy = [...sourceAssignment.tasks];

          sourceTasksCopy.splice(i, 1);

          const targetTasksCopy = [...targetAssignment.tasks];

          targetTasksCopy.push({
            ...task,
            estimated_time: newEstimatedTime,
            raw_estimated_time: rawTime,
          });

          // Создаем временные копии назначений
          const sourceCopy = { ...sourceAssignment, tasks: sourceTasksCopy };
          const targetCopy = { ...targetAssignment, tasks: targetTasksCopy };

          // Пересчитываем время
          recalculateAssignment(sourceCopy);
          recalculateAssignment(targetCopy);

          // Проверяем, уменьшилась ли разница между самым загруженным и наименее загруженным
          const newDifference = Math.abs(
            sourceCopy.total_effective_time - targetCopy.total_effective_time,
          );

          if (newDifference < bestFinalDifference) {
            bestFinalDifference = newDifference;
            bestTaskIndex = i;
          }
        }

        // Если нашли задачу, которая улучшает ситуацию - перемещаем её
        if (bestTaskIndex !== -1) {
          const corridorCounts = countEmployeesPerCorridor();

          moveTaskBetweenAssignments(
            sourceAssignment,
            targetAssignment,
            bestTaskIndex,
            corridorCounts,
          );

          console.log(
            `Финальная корректировка выполнена. Новая разница: ${Math.abs(
              sourceAssignment.total_effective_time -
                targetAssignment.total_effective_time,
            ).toFixed(1)} мин.`,
          );
        } else {
          console.log("Не удалось найти задачу для финальной корректировки.");
        }
      } else {
        console.log(
          `Финальная разница составляет ${finalDeviation.toFixed(1)} минут. Дополнительная корректировка не требуется.`,
        );
      }

      // 4. Пост-обработка: Тележки, Сверхурочные, Время окончания
      let employeesNeedingTrolleyCount = 0;

      currentAssignments.forEach((assignment) => {
        // Проверка на тележку: нужна, если есть хотя бы одна задача в комнате без склада
        const needsTrolley = assignment.tasks.some((task) => {
          // Проверка наличия склада по номеру комнаты, а не по коридору
          return !doesRoomHaveStorage(task.room);
        });

        assignment.needs_trolley = needsTrolley;

        // Счетчик пока не трогаем, т.к. он нужен для too_many_trolleys, но финальное решение принимает limitTrolleys
        // if (needsTrolley) {
        //   employeesNeedingTrolleyCount++;
        // }

        // Проверка на сверхурочные (рабочий день до 15:00, то есть 6 часов = 360 минут)
        const availableWorkTime = 360; // было 345 (5 часов 45 минут)

        assignment.is_overtime =
          assignment.total_effective_time > availableWorkTime;

        // Расчет времени окончания
        const startTime = new Date();

        startTime.setHours(9, 0, 0, 0);
        const finishTime = addMinutes(
          startTime,
          assignment.total_effective_time,
        );

        assignment.estimated_finish_time_str = formatTime(finishTime);
      });

      // 5. Формирование результата
      const result: AssignmentResult = {
        assignments: currentAssignments,
        // Calculate initial trolley needs for the flag, but final assignment happens in limitTrolleys
        too_many_trolleys:
          currentAssignments.filter((a) =>
            a.tasks.some((task) => !doesRoomHaveStorage(task.room)),
          ).length > 2,
      };

      console.log("Результат распределения (предварительный):", result);
      // setAssignments(result); // Don't set preliminary results, wait for trolley limit

      // Ограничиваем количество тележек до 2 для сотрудников с наибольшим числом задач в комнатах без склада
      const limitTrolleys = () => {
        // Сбрасываем флаг 'needs_trolley' для всех перед перерасчетом
        currentAssignments.forEach((a) => (a.needs_trolley = false));

        // Создаем массив сотрудников, которым потенциально нужны тележки
        const potentialTrolleyNeeds = currentAssignments
          .map((a) => {
            // Считаем количество задач в комнатах без склада по номеру комнаты
            const tasksInNoStorageRooms = a.tasks.filter((task) => {
              return !doesRoomHaveStorage(task.room);
            }).length;

            // Если у сотрудника есть такие задачи, он - кандидат на тележку
            return {
              assignment: a,
              tasksInNoStorageRooms,
              isCandidate: tasksInNoStorageRooms > 0,
            };
          })
          .filter((item) => item.isCandidate) // Фильтруем тех, у кого нет комнат без склада
          .sort((a, b) => b.tasksInNoStorageRooms - a.tasksInNoStorageRooms); // Сортируем по количеству комнат без склада

        // Отмечаем 'needs_trolley = true' только для первых двух (или меньше) кандидатов
        potentialTrolleyNeeds.slice(0, 2).forEach((item) => {
          item.assignment.needs_trolley = true;
        });

        // После распределения тележек, перерасчитываем время для тех, кто остался без тележек
        // Для каждой комнаты без склада у сотрудника без тележки добавляем 3 минуты
        currentAssignments.forEach((assignment) => {
          // Проверяем, не получил ли этот работник тележку
          if (!assignment.needs_trolley) {
            let additionalTimeTotal = 0;
            let needsRecalculation = false; // Flag to track if recalculation is needed

            // Обрабатываем все задачи для этого назначения
            assignment.tasks.forEach((task) => {
              // Проверяем, что комната без склада
              if (!doesRoomHaveStorage(task.room)) {
                // Добавляем 3 минуты к *скорректированному* времени задачи
                // Важно: не меняем raw_estimated_time
                task.estimated_time += 3;
                additionalTimeTotal += 3;
                needsRecalculation = true; // Отмечаем, что время изменилось
              }
            });

            // Если было добавлено время, пересчитываем все показатели
            if (needsRecalculation) {
              console.log(
                `Добавлено ${additionalTimeTotal} минут к заданиям для ${assignment.employee} (без тележки)`,
              );
              recalculateAssignment(assignment); // Используем общую функцию пересчета
            }
          }
        });

        // Устанавливаем флаг too_many_trolleys, если кандидатов было больше 2
        return potentialTrolleyNeeds.length > 2;
      };

      // Вызываем функцию ограничения тележек и обновляем результат
      const tooManyTrolleys = limitTrolleys();

      // Обновляем состояние assignments с финальным распределением тележек
      setAssignments({
        assignments: currentAssignments,
        too_many_trolleys: tooManyTrolleys,
      });
    } catch (error) {
      console.error("Error generating assignments:", error);
      alert("Произошла ошибка при распределении задач.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate working employees count based on the synchronized state
  const workingEmployeesCount = employees.filter(
    (emp) => emp.istodayworking,
  ).length;

  // Сортировка сотрудников - сначала работающие, потом неработающие (uses updated state)
  const sortedEmployees = [...employees].sort((a, b) => {
    if (a.istodayworking === b.istodayworking) {
      return a.name.localeCompare(b.name);
    }

    return a.istodayworking ? -1 : 1;
  });

  // Функция обновления типа задания
  const handleTaskTypeChange = (room: number, newType: string) => {
    console.log(
      `Changing task type for room ${room} to: ${newType === "-" ? "empty" : newType}`,
    );

    // Если выбрано "Не требует уборки" (-), то очищаем поле
    const finalType = newType === "-" ? "" : newType;

    setRoomTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.room === room ? { ...task, type: finalType } : task,
      ),
    );
    // Сбрасываем назначения при изменении задач, так как расчеты станут неверными
    setAssignments(null);
  };

  // Функция для сброса всех заданий в коридоре
  const resetCorridorTasks = (corridorId: number) => {
    if (
      confirm(
        `Вы уверены, что хотите сбросить все типы заданий в коридоре ${corridorId}?`,
      )
    ) {
      setRoomTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.corridor === corridorId ? { ...task, type: "" } : task,
        ),
      );
      // Сбрасываем назначения при изменении задач
      setAssignments(null);
    }
  };

  // Функция для установки одного типа задания для всех комнат в коридоре
  const setTypeForCorridor = (corridorId: number, newType: string) => {
    // Если выбрано "Не требует уборки" (-), то очищаем поле
    const finalType = newType === "-" ? "" : newType;

    setRoomTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.corridor === corridorId ? { ...task, type: finalType } : task,
      ),
    );
    // Сбрасываем назначения при изменении задач
    setAssignments(null);
  };

  // Функция обновления примечания
  const handleNoteChange = (room: number, newNote: string) => {
    console.log(`Changing note for room ${room} to: ${newNote}`);
    setRoomTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.room === room ? { ...task, note: newNote } : task,
      ),
    );
    // Сбрасываем назначения при изменении задач
    setAssignments(null);
  };

  return (
    <section className="flex flex-col gap-2 pt-0 pb-4">
      {/* Header */}
      <div className="text-center -mt-4">
        <h1 className={title({ color: "cyan", class: "text-primary-600" })}>
          Housekeeping Management
        </h1>
        <p className={subtitle({ class: "mt-1 text-primary-800" })}>
          Manage tasks and automatically assign them to available employees
        </p>
      </div>

      {/* Employees Section */}
      <div className="mt-4">
        {/* Update header to use workingEmployeesCount and display the date */}
        <h2
          className={title({ size: "sm", class: "text-primary-700 text-base" })}
        >
          Team Members ({workingEmployeesCount} Working{" "}
          {currentWorkingDayString ? `on ${currentWorkingDayString}` : "Today"})
        </h2>
        <Divider className="my-4 bg-primary-200" />

        {/* Объединяем контролы для создания команд и заголовок для команд в один блок */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-3">
          <div className="flex flex-col sm:flex-row items-start gap-4 w-full sm:w-auto">
            {/* Показываем информацию о выбранных сотрудниках */}
            {selectedEmployees.length > 0 && (
              <span className="text-sm font-medium text-primary-700">
                Выбрано сотрудников: {selectedEmployees.length}
              </span>
            )}

            {/* Всегда показываем сформированные команды, если они есть */}
            {teams.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start gap-2 w-full">
                <span className="text-sm font-medium text-primary-700 mt-2 whitespace-nowrap">
                  Сформированные команды:
                </span>
                {/* Отображение текущих команд */}
                <div className="flex flex-wrap gap-2 mt-1 sm:mt-0">
                  {teams.map((team) => {
                    const workingMembers = employees.filter(
                      (e) => team.members.includes(e.name) && e.istodayworking,
                    );

                    if (workingMembers.length === 0) return null;

                    return (
                      <Card key={`team-${team.id}`} className="max-w-fit">
                        <div className="p-1 flex items-center gap-1">
                          <span
                            className={`${getTeamColor(team.id)} inline-flex items-center justify-center rounded-full w-4 h-4 xs:w-auto xs:h-auto xs:rounded-md xs:px-1.5 xs:py-0.5 xs:text-xs xs:font-medium`}
                          >
                            <span className="hidden xs:inline">
                              Team {team.id}
                            </span>
                          </span>
                          <span className="hidden xs:inline-block text-xs text-primary-600">
                            ({workingMembers.length}/{team.members.length})
                          </span>

                          <div className="flex items-center mx-1">
                            {workingMembers.map((member, index) => (
                              <div
                                key={`team-member-${member.name}`}
                                style={{ marginLeft: index > 0 ? "-8px" : "0" }}
                                title={member.name}
                              >
                                <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white">
                                  <EmployeeAvatar
                                    className="!w-full !h-full"
                                    name={member.name}
                                    size="sm"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button
                            className="text-xs p-0 min-w-0 h-5 w-5"
                            color="danger"
                            size="sm"
                            variant="light"
                            onPress={() => removeTeam(team.id)}
                          >
                            ×
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 self-end sm:self-start">
            <Button
              color="primary"
              isDisabled={selectedEmployees.length === 0}
              size="sm"
              variant="flat"
              onPress={createTeam}
            >
              Создать команду
            </Button>
            <Button
              color="danger"
              isDisabled={selectedEmployees.length === 0}
              size="sm"
              variant="flat"
              onPress={() => setSelectedEmployees([])}
            >
              Сбросить выбор
            </Button>
          </div>
        </div>

        {/* Сетка сотрудников - переделываем в один ряд с растянутым содержимым */}
        {/* Use sortedEmployees which reflects the current working status */}
        <div className="flex flex-row w-full gap-1 xs:gap-2 md:gap-3">
          {sortedEmployees.map((employee) => {
            const team = getEmployeeTeam(employee.name);
            const isSelected = selectedEmployees.includes(employee.name);

            return (
              <div
  key={employee.name}
  role="button"
  tabIndex={0}
  onClick={() =>
    employee.istodayworking &&
    toggleEmployeeSelection(employee.name)
  }
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      employee.istodayworking &&
      toggleEmployeeSelection(employee.name);
    }
  }}
  className={`flex flex-col items-center cursor-pointer flex-1 ${isSelected ? "ring-2 ring-primary-400 rounded-lg p-1 bg-primary-50" : "p-1"}`}
  title={
    employee.istodayworking
      ? `Кликните для ${isSelected ? "отмены выбора" : "выбора"} сотрудника`
      : "Сотрудник не работает сегодня"
  }
>
                <div className="relative w-full aspect-square overflow-hidden rounded-lg mb-1">
                  <div
                    className={`relative w-full h-full ${!employee.istodayworking ? "grayscale opacity-50" : ""}`}
                  >
                    {isNewEmployee(employee) && (
                      <div className="absolute top-0 right-0 z-20">
                        <span className="bg-blue-700 text-white text-[7px] xs:text-[8px] sm:text-xs px-1 py-0.5 rounded-br-lg rounded-tl-lg font-medium">
                          New
                        </span>
                      </div>
                    )}
                    {team && employee.istodayworking && (
                      <div className="absolute top-0 left-0 z-20">
                        <span
                          className={`${getTeamColor(team.id)} inline-flex items-center justify-center rounded-full w-4 h-4 xs:w-auto xs:h-auto xs:rounded-md xs:px-1.5 xs:py-0.5 xs:text-xs xs:font-medium`}
                        >
                          <span className="text-[0px] xs:text-xs">
                            Team {team.id}
                          </span>
                        </span>
                      </div>
                    )}

                    <Image
                      fill
                      priority
                      alt={employee.name}
                      className="object-cover"
                      sizes="(max-width: 480px) 1fr, (max-width: 640px) 1fr, (max-width: 768px) 1fr, 1fr"
                      src={`/img/${employee.name}.png`}
                      onError={(e) => {
                        console.warn(
                          `Image not found for ${employee.name}, using fallback.`,
                        );
                        (e.target as HTMLImageElement).src =
                          "/img/default-avatar.png";
                      }}
                    />
                  </div>
                  {!employee.istodayworking && (
                    <div className="absolute inset-0 bg-primary-900 bg-opacity-30 flex items-center justify-center">
                      <span className="text-white font-medium text-[7px] xs:text-[8px] sm:text-xs bg-primary-800 bg-opacity-70 px-1 py-0.5 rounded">
                        Off
                      </span>
                    </div>
                  )}
                  {employee.istodayworking && isSelected && (
                    <div className="absolute right-1 bottom-1 z-20 bg-primary-500 text-white rounded-full w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center">
                      <svg
                        className="h-2 w-2 sm:h-3 sm:w-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          clipRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          fillRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="text-primary-800 font-semibold text-center text-[10px] xs:text-xs sm:text-sm truncate w-full">
                  {employee.name}
                </h3>
                <p
                  className={`text-[7px] xs:text-[8px] sm:text-xs ${employee.istodayworking ? "text-secondary-600" : "text-primary-500"}`}
                >
                  {/* Update text based on synchronized 'istodayworking' */}
                  {employee.istodayworking ? "Working" : "Off Duty"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Room Tasks Table */}
      <div className="mt-8">
        <div className="flex justify-between items-center flex-wrap gap-2">
          {" "}
          {/* Добавлен flex-wrap и gap-2 */}
          <h2
            className={title({
              size: "sm",
              class: "text-primary-700 text-base",
            })}
          >
            Задания по комнатам
          </h2>
          <div className="flex space-x-2 flex-shrink-0">
            {" "}
            {/* Добавлен flex-shrink-0 */}
            <Button
              className="bg-primary-300 hover:bg-primary-400 text-primary-900" 
              color="primary"
              size="sm"
              title={isEditing ? "Сохраните изменения перед генерацией" :
                     workingEmployeesCount === 0 ? `Нет работающих сотрудников на ${currentWorkingDayString || 'сегодня'}` :
                     roomTasks.length === 0 ? "Нет задач для генерации" : "Сгенерировать назначения"}
              variant="flat"
              onPress={handleGenerateAssignments}
              isLoading={loading}
              // Update disable condition based on workingEmployeesCount
              isDisabled={isEditing || workingEmployeesCount === 0 || roomTasks.length === 0}
            >
              Generate Assignments
            </Button>
            <Button
              className={isEditing ? "bg-green-100 text-green-800" : "bg-primary-100 text-primary-800"}
              color={isEditing ? "success" : "primary"}
              isDisabled={loading}
              size="sm"
              onPress={() => {
                // Если выходим из режима редактирования, сбрасываем назначения
                if (isEditing) {
                  setAssignments(null); 
                  setEditingCorridor(null); // Сбрасываем выбранный коридор при выходе из режима редактирования
                }
                setIsEditing(!isEditing);
              }}
              // Блокируем кнопку, если идет генерация
              variant="flat" 
            >
              {isEditing ? "Сохранить изменения" : "Редактировать задания"}
            </Button>
          </div>
        </div>
        <Divider className="my-4 bg-primary-200" />

        <div className="overflow-x-auto">
          <table className="min-w-full bg-primary-50 rounded-lg overflow-hidden border border-primary-200">
            <thead className="bg-primary-100 text-primary-800">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium uppercase tracking-wider">
                  Комната
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium uppercase tracking-wider">
                  Тип задания
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium uppercase tracking-wider">
                  Примечание
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium uppercase tracking-wider">
                  Работник
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-200">
              {roomTasks
                .sort((a, b) => {
                  const corridorA = a.corridor || 0;
                  const corridorB = b.corridor || 0;

                  if (corridorA !== corridorB) {
                    return corridorA - corridorB;
                  }

                  return (a.room || 0) - (b.room || 0);
                })
                .reduce((acc: JSX.Element[], task, index, array) => {
                  const currentCorridor = task.corridor;
                  const prevCorridor =
                    index > 0 ? array[index - 1].corridor : null;
                  const isNewCorridor =
                    index === 0 || currentCorridor !== prevCorridor;

                  // Добавляем заголовок коридора
                  if (isNewCorridor && currentCorridor) {
                    const corridorTasks = array.filter(
                      (t) => t.corridor === currentCorridor,
                    );

                    // Определяем, есть ли склад в этом коридоре
                    // Склад есть в коридорах 1, 3 и 6 согласно заданию клиента
                    const hasStorage = [1, 3, 6].includes(currentCorridor);
                    const sideText =
                      corridorDetails[currentCorridor]?.side === "east"
                        ? "Восточная"
                        : "Западная";

                    const { bgColorClass, textColorClass } = (() => {
                      switch (currentCorridor) {
                        case 1:
                          return {
                            bgColorClass: "bg-sky-100",
                            textColorClass: "text-sky-800",
                          };
                        case 2:
                          return {
                            bgColorClass: "bg-violet-100",
                            textColorClass: "text-violet-800",
                          };
                        case 3:
                          return {
                            bgColorClass: "bg-lime-100",
                            textColorClass: "text-lime-800",
                          };
                        case 4:
                          return {
                            bgColorClass: "bg-teal-100",
                            textColorClass: "text-teal-800",
                          };
                        case 5:
                          return {
                            bgColorClass: "bg-amber-100",
                            textColorClass: "text-amber-800",
                          };
                        case 6:
                          return {
                            bgColorClass: "bg-rose-100",
                            textColorClass: "text-rose-800",
                          };
                        default:
                          return {
                            bgColorClass: "bg-gray-100",
                            textColorClass: "text-gray-800",
                          };
                      }
                    })();

                    acc.push(
                      <tr
                        key={`corridor-${currentCorridor}`}
                        className="border-t-2 border-white"
                      >
                        <td
                          className={`py-2 px-3 text-xs font-bold ${textColorClass} ${bgColorClass}`}
                          colSpan={4}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div
                                className={`w-3 h-3 rounded-full mr-2 ${bgColorClass.replace("100", "400")}`}
                              />
                              Коридор {currentCorridor}: {sideText} сторона,{" "}
                              {corridorDetails[currentCorridor]?.floor || ""}{" "}
                              этаж
                              {hasStorage && (
                                <span
                                  className={`ml-2 inline-block bg-${bgColorClass.split("-")[1]}-50 ${textColorClass} text-[10px] px-1 py-0.5 rounded border border-${bgColorClass.split("-")[1]}-200`}
                                >
                                  ✅ Есть склад
                                </span>
                              )}
                            </div>

                            {isEditing && (
                              <div className="flex items-center gap-2">
                                {editingCorridor === currentCorridor ? (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-primary-600">
                                        Установить тип:
                                      </span>
                                      <Select
                                        aria-label="Выберите тип для всех комнат"
                                        className="max-w-[120px] min-w-[120px]"
                                        placeholder="Тип задания"
                                        size="sm"
                                        variant="flat"
                                        onSelectionChange={(keys) => {
                                          if (keys instanceof Set) {
                                            const selectedKey =
                                              keys.size > 0
                                                ? (Array.from(
                                                    keys,
                                                  )[0] as string)
                                                : "";

                                            setTypeForCorridor(
                                              currentCorridor,
                                              selectedKey,
                                            );
                                          }
                                        }}
                                      >
                                        {taskTypes.map((type) => (
                                          <SelectItem
                                            key={type.value}
                                            className={
                                              type.value === "V"
                                                ? "text-blue-800 bg-blue-50/60 hover:bg-blue-100 text-xs"
                                                : type.value === "B"
                                                  ? "text-green-800 bg-green-50/60 hover:bg-green-100 text-xs"
                                                  : type.value === "N"
                                                    ? "text-orange-800 bg-orange-50/60 hover:bg-orange-100 text-xs"
                                                    : type.value === "V/N"
                                                      ? "text-purple-800 bg-purple-50/60 hover:bg-purple-100 text-xs"
                                                      : type.value === "-"
                                                        ? "text-gray-800 bg-gray-50/60 hover:bg-gray-100 text-xs"
                                                        : "text-gray-800 bg-gray-50/60 hover:bg-gray-100 text-xs"
                                            }
                                          >
                                            {type.label}
                                          </SelectItem>
                                        ))}
                                      </Select>
                                    </div>
                                    <Button
                                      className="text-[10px] h-6 px-1 min-w-0"
                                      color="danger"
                                      size="sm"
                                      variant="flat"
                                      onPress={() =>
                                        resetCorridorTasks(currentCorridor)
                                      }
                                    >
                                      Сбросить все
                                    </Button>
                                    <Button
                                      className="text-[10px] h-6 px-1 min-w-0"
                                      color="primary"
                                      size="sm"
                                      variant="flat"
                                      onPress={() => setEditingCorridor(null)}
                                    >
                                      Готово
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    className="text-[10px] h-6 px-1 min-w-0"
                                    color="primary"
                                    size="sm"
                                    variant="flat"
                                    onPress={() =>
                                      setEditingCorridor(currentCorridor)
                                    }
                                  >
                                    Редактировать задания
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>,
                    );
                  }

                  // Находим назначенного сотрудника
                  let assignedEmployeeData: Assignment | undefined;

                  if (!isEditing && assignments) {
                    assignedEmployeeData = assignments.assignments.find(
                      (assignment) =>
                        assignment.tasks.some((t) => t.room === task.room),
                    );
                  }
                  const assignedEmployeeName = assignedEmployeeData?.employee;

                  // Получаем цвет для строки на основе коридора или назначенного сотрудника
                  const rowColorClass =
                    !isEditing && assignedEmployeeName
                      ? getEmployeeRowColor(assignedEmployeeName)
                      : getRowColor(task);

                  // Добавляем строку с заданием
                  acc.push(
                    <tr
                      key={`task-${task.room}-${index}`}
                      className={rowColorClass}
                    >
                      <td className="py-2 px-3 text-sm text-primary-800 font-medium">
                        {task.room}
                      </td>

                      {isEditing ? (
                        <td className="py-2 px-3 text-xs">
                          <Select
                            aria-label={`Выберите тип задания для комнаты ${task.room}`}
                            className="max-w-xs font-sans"
                            placeholder="Тип задания"
                            selectedKeys={task.type ? [task.type] : []}
                            size="sm"
                            variant="flat"
                            onSelectionChange={(keys) => {
                              if (keys instanceof Set) {
                                const selectedKey =
                                  keys.size > 0
                                    ? (Array.from(keys)[0] as string)
                                    : "";

                                handleTaskTypeChange(task.room, selectedKey);
                              }
                            }}
                          >
                            {taskTypes.map((type) => (
                              <SelectItem
                                key={type.value}
                                className={
                                  type.value === "V"
                                    ? "text-blue-800 bg-blue-50/60 hover:bg-blue-100 text-sm"
                                    : type.value === "B"
                                      ? "text-green-800 bg-green-50/60 hover:bg-green-100 text-sm"
                                      : type.value === "N"
                                        ? "text-orange-800 bg-orange-50/60 hover:bg-orange-100 text-sm"
                                        : type.value === "V/N"
                                          ? "text-purple-800 bg-purple-50/60 hover:bg-purple-100 text-sm"
                                          : type.value === "-"
                                            ? "text-gray-800 bg-gray-50/60 hover:bg-gray-100 text-sm"
                                            : "text-gray-800 bg-gray-50/60 hover:bg-gray-100 text-sm"
                                }
                              >
                                {type.label}
                              </SelectItem>
                            ))}
                          </Select>
                        </td>
                      ) : (
                        <td className="py-2 px-3 text-xs">
                          {task.type ? (
                            <span
                              className={(() => {
                                switch (task.type) {
                                  case "V":
                                    return "bg-blue-100 text-blue-800 px-2 py-1 rounded-full";
                                  case "B":
                                    return "bg-green-100 text-green-800 px-2 py-1 rounded-full";
                                  case "N":
                                    return "bg-orange-100 text-orange-800 px-2 py-1 rounded-full";
                                  case "V/N":
                                    return "bg-purple-100 text-purple-800 px-2 py-1 rounded-full";
                                  case "-":
                                    return "bg-gray-100 text-gray-800 px-2 py-1 rounded-full";
                                  default:
                                    return "bg-gray-100 text-gray-800 px-2 py-1 rounded-full";
                                }
                              })()}
                            >
                              {task.type} - {getTaskTypeName(task.type)}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      )}

                      {isEditing ? (
                        <td className="py-2 px-3 text-xs">
                          <Select
                            aria-label={`Выберите примечание для комнаты ${task.room}`}
                            className="max-w-xs font-sans"
                            placeholder="Примечание"
                            selectedKeys={task.note ? [task.note] : [""]}
                            size="sm"
                            variant="flat"
                            onSelectionChange={(keys) => {
                              if (keys instanceof Set) {
                                const selectedKey =
                                  keys.size > 0
                                    ? (Array.from(keys)[0] as string)
                                    : "";

                                handleNoteChange(task.room, selectedKey);
                              }
                            }}
                          >
                            {notesOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                className="font-sans text-sm"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </Select>
                        </td>
                      ) : (
                        <td className="py-2 px-3 text-xs text-primary-700">
                          {task.note || "-"}
                        </td>
                      )}

                      {/* Столбец с назначенным сотрудником */}
                      <td className="py-2 px-3 text-xs">
                        {assignedEmployeeName ? (
                          <div
                            className="flex items-center"
                            title={assignedEmployeeName}
                          >
                            {isTeamName(assignedEmployeeName) &&
                            assignedEmployeeData?.team_members ? (
                              <div className="flex items-center">
                                <div className="flex -space-x-2 mr-2">
                                  {assignedEmployeeData.team_members
                                    .slice(0, 3)
                                    .map((member, idx) => (
                                      <div
                                        key={`table-avatar-${member}-${idx}`}
                                        className="relative w-9 h-9 rounded-full border border-white"
                                      >
                                        <EmployeeAvatar
                                          className="!w-full !h-full"
                                          name={member}
                                          size="lg"
                                        />
                                      </div>
                                    ))}
                                  {assignedEmployeeData.team_members.length >
                                    3 && (
                                    <div className="relative w-9 h-9 flex items-center justify-center bg-primary-200 rounded-full border border-white">
                                      <span className="text-[10px] text-primary-700">
                                        +
                                        {assignedEmployeeData.team_members
                                          .length - 3}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-primary-800 truncate">
                                  {assignedEmployeeName.startsWith("Команда") &&
                                  assignedEmployeeData.team_members
                                    ? assignedEmployeeData.team_members.join(
                                        " & ",
                                      )
                                    : assignedEmployeeName}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <EmployeeAvatar
                                  className="!w-11 !h-11"
                                  name={assignedEmployeeName}
                                  size="lg"
                                />
                                <span className="ml-2 text-primary-800 truncate">
                                  {assignedEmployeeName}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">
                            {isEditing ? "..." : "-"}
                          </span>
                        )}
                      </td>
                    </tr>,
                  );

                  return acc;
                }, [])}
            </tbody>
          </table>
        </div>

        {/* Отображаем результаты распределения (Total estimated time и детали) */}
        {/* Показываем только если не редактируем и есть назначения */}
        {!isEditing && assignments && (
          <div className="mt-4 bg-primary-50 p-4 rounded-lg border border-primary-200">
            <h3 className="text-sm font-medium text-primary-800 mb-3">
              Результаты распределения:
            </h3>

            <Accordion
              className="grid grid-cols-1 gap-3"
              selectionMode="single"
              variant="light"
            >
              {/* Сортируем по имени сотрудника для консистентного отображения */}
              {[...assignments.assignments] // Клонируем массив перед сортировкой
                .sort((a, b) => a.employee.localeCompare(b.employee))
                .map((assignment, index) => (
                  <AccordionItem
                    key={`employee-${index}-${assignment.employee}`}
                    aria-label={`Детали для ${assignment.employee}`}
                    classNames={{
                      base: `bg-white rounded-lg shadow-sm border p-0 ${assignment.is_overtime ? "border-red-300" : "border-primary-100"}`,
                      title: "text-sm font-medium",
                      trigger: "p-3 hover:bg-primary-50/50 w-full text-left",
                      indicator: "text-primary-500",
                      content: "p-0 text-sm",
                    }}
                    title={
                      <div className="flex flex-col w-full">
                        <div className="flex items-center w-full mb-1">
                          {/* Аватар или иконка команды */}
                          <div className="mr-2 flex-shrink-0">
                            {assignment.team_size &&
                            assignment.team_size > 1 &&
                            assignment.team_members ? (
                              <div className="flex -space-x-2">
                                {assignment.team_members
                                  .slice(0, 2)
                                  .map((member, idx) => (
                                    <div
                                      key={`avatar-${member}-${idx}`}
                                      className="relative w-8 h-8 rounded-full overflow-hidden border border-white"
                                    >
                                      <EmployeeAvatar
                                        className="!w-full !h-full"
                                        name={member}
                                        size="md"
                                      />
                                    </div>
                                  ))}
                                {assignment.team_members.length > 2 && (
                                  <div className="relative w-8 h-8 flex items-center justify-center bg-primary-200 rounded-full border border-white text-[10px] text-primary-700">
                                    +{assignment.team_members.length - 2}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <EmployeeAvatar
                                className="!w-9 !h-9"
                                name={assignment.employee}
                                size="md"
                              />
                            )}
                          </div>

                          {/* Имя и основные показатели в одной линии */}
                          <div className="flex-grow">
                            <div className="flex items-center">
                              <span
                                className="font-medium text-primary-800 mr-2"
                                title={assignment.employee}
                              >
                                {assignment.employee.startsWith("Команда") &&
                                assignment.team_members
                                  ? assignment.team_members.length > 2
                                    ? `Команда (${assignment.team_members.length})`
                                    : assignment.team_members.join(" & ")
                                  : assignment.employee}
                              </span>

                              {/* Индикаторы справа */}
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                {/* Индикатор овертайма */}
                                {assignment.is_overtime && (
                                  <Badge
                                    className="text-[10px] font-medium"
                                    color="danger"
                                    size="sm"
                                    variant="flat"
                                  >
                                    OT
                                  </Badge>
                                )}
                                {/* Индикатор тележки */}
                                {assignment.needs_trolley && (
                                  <span
                                    className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-medium flex items-center"
                                    title="Нужна тележка"
                                  >
                                    <svg
                                      className="h-3 w-3 mr-0.5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <circle cx="9" cy="21" r="1" />
                                      <circle cx="20" cy="21" r="1" />
                                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                    </svg>
                                    Тележка
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Быстрая информация в компактном виде */}
                            <div className="flex items-center justify-between text-[10px] text-primary-600 mt-0.5">
                              <div className="flex items-center space-x-2">
                                <span>
                                  Задач: <b>{assignment.tasks.length}</b>
                                </span>
                                <span>
                                  Время:{" "}
                                  <b>
                                    {assignment.total_effective_time.toFixed()}{" "}
                                    мин
                                  </b>
                                </span>
                                <span
                                  title={`Ожидаемое время окончания: ${assignment.estimated_finish_time_str}`}
                                >
                                  <b
                                    className={
                                      assignment.is_overtime
                                        ? "text-red-600"
                                        : ""
                                    }
                                  >
                                    ~{assignment.estimated_finish_time_str}
                                  </b>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Визуальная шкала распределения типов задач */}
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex mt-2 mb-1">
                          {(() => {
                            // Получаем статистику по типам
                            const stats = {
                              V: 0,
                              B: 0,
                              N: 0,
                              "V/N": 0,
                              "-": 0,
                            };

                            // Считаем количество каждого типа
                            assignment.tasks.forEach((task) => {
                              const originalTask = roomTasks.find(
                                (rt) => rt.room === task.room,
                              );

                              if (originalTask?.type) {
                                stats[
                                  originalTask.type as keyof typeof stats
                                ] += 1;
                              }
                            });

                            const total = assignment.tasks.length;

                            if (total === 0) return null;

                            // Цвета для каждого типа
                            const colors = {
                              V: "bg-blue-400",
                              B: "bg-green-400",
                              N: "bg-orange-400",
                              "V/N": "bg-purple-400",
                              "-": "bg-gray-400",
                            };

                            // Создаем сегменты шкалы
                            return Object.entries(stats).map(
                              ([type, count]) => {
                                if (count === 0) return null;
                                const width = (count / total) * 100;

                                return (
                                  <div
                                    key={`bar-${type}`}
                                    className={`h-full ${colors[type as keyof typeof colors]}`}
                                    style={{ width: `${width}%` }}
                                    title={`${type}: ${count} (${Math.round(width)}%)`}
                                  />
                                );
                              },
                            );
                          })()}
                        </div>

                        {/* Нижний ряд с чипсами статистики и информацией о складе */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {/* Статистика по типам комнат */}
                          {(() => {
                            // Подсчитываем количество комнат разных типов
                            const roomTypeCount: Record<string, number> = {};

                            // Перебираем задачи и группируем по типу
                            assignment.tasks.forEach((task) => {
                              const originalTask = roomTasks.find(
                                (rt) => rt.room === task.room,
                              );

                              if (originalTask?.type) {
                                roomTypeCount[originalTask.type] =
                                  (roomTypeCount[originalTask.type] || 0) + 1;
                              }
                            });

                            // Возвращаем чипсы со статистикой по типам комнат
                            return Object.entries(roomTypeCount).map(
                              ([type, count]) => {
                                // Определяем стиль в зависимости от типа
                                const chipStyle = (() => {
                                  switch (type) {
                                    case "V":
                                      return "bg-blue-100 text-blue-800";
                                    case "B":
                                      return "bg-green-100 text-green-800";
                                    case "N":
                                      return "bg-orange-100 text-orange-800";
                                    case "V/N":
                                      return "bg-purple-100 text-purple-800";
                                    default:
                                      return "bg-gray-100 text-gray-800";
                                  }
                                })();

                                return (
                                  <span
                                    key={`stat-${type}`}
                                    className={`${chipStyle} font-medium rounded-full px-2 py-0.5 text-[10px] flex items-center`}
                                  >
                                    {type}: {count}
                                  </span>
                                );
                              },
                            );
                          })()}

                          {/* Информация о комнатах без склада */}
                          {(() => {
                            // Получаем номера комнат, назначенных этому сотруднику/команде
                            const assignedRooms = assignment.tasks.map(
                              (task) => task.room,
                            );

                            // Проверяем каждую комнату на наличие склада
                            const noStorageRooms = assignedRooms.filter(
                              (room) => !doesRoomHaveStorage(room),
                            );

                            const noStorageRoomCount = noStorageRooms.length;
                            const roomWord =
                              noStorageRoomCount === 1
                                ? "комната"
                                : noStorageRoomCount >= 2 &&
                                    noStorageRoomCount <= 4
                                  ? "комнаты"
                                  : "комнат";

                            return (
                              <span className="flex items-center bg-yellow-100 text-yellow-800 font-medium rounded-full px-2 py-0.5 text-[10px]">
                                {assignment.needs_trolley && (
                                  <svg
                                    className="h-3 w-3 mr-0.5 text-blue-600"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <circle cx="9" cy="21" r="1" />
                                    <circle cx="20" cy="21" r="1" />
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                  </svg>
                                )}
                                {noStorageRoomCount} {roomWord} без склада
                              </span>
                            );
                          })()}
                        </div>

                        {/* Добавляем чипсы с коридорами */}
                        <div className="flex flex-wrap gap-1 mt-1 mb-0.5">
                          {(() => {
                            // Получаем уникальные коридоры
                            const corridorsWithDuplicates = assignment.tasks
                              .map((task) => task.corridor)
                              .filter(
                                (corridor): corridor is number =>
                                  corridor !== undefined,
                              );

                            // Удаляем дубликаты ручным способом вместо Set
                            const corridors: number[] = [];

                            corridorsWithDuplicates.forEach((corridor) => {
                              if (!corridors.includes(corridor)) {
                                corridors.push(corridor);
                              }
                            });

                            // Сортируем коридоры
                            corridors.sort((a, b) => a - b);

                            // Отображаем компактные чипсы для каждого коридора
                            return corridors.map((corridor) => {
                              // Определяем цвет для коридора
                              const chipColor = (() => {
                                switch (corridor) {
                                  case 1:
                                    return "bg-sky-100 text-sky-800";
                                  case 2:
                                    return "bg-violet-100 text-violet-800";
                                  case 3:
                                    return "bg-lime-100 text-lime-800";
                                  case 4:
                                    return "bg-teal-100 text-teal-800";
                                  case 5:
                                    return "bg-amber-100 text-amber-800";
                                  case 6:
                                    return "bg-rose-100 text-rose-800";
                                  default:
                                    return "bg-gray-100 text-gray-800";
                                }
                              })();

                              // Находим комнаты для этого коридора
                              const rooms = assignment.tasks
                                .filter((task) => task.corridor === corridor)
                                .map((task) => task.room)
                                .sort((a, b) => a - b);

                              // Создаем диапазоны номеров комнат
                              const ranges: string[] = [];
                              let start = rooms[0];
                              let prev = rooms[0];

                              for (let i = 1; i < rooms.length; i++) {
                                if (rooms[i] !== prev + 1) {
                                  // Если последовательность прервалась
                                  ranges.push(
                                    start === prev
                                      ? `${start}`
                                      : `${start}-${prev}`,
                                  );
                                  start = rooms[i];
                                }
                                prev = rooms[i];
                              }

                              // Добавляем последний диапазон
                              if (rooms.length > 0) {
                                ranges.push(
                                  start === prev
                                    ? `${start}`
                                    : `${start}-${prev}`,
                                );
                              }

                              const roomsText = ranges.join(", ");

                              return (
                                <span
                                  key={`corridor-${corridor}`}
                                  className={`${chipColor} text-[10px] font-medium rounded px-1.5 py-0.5 flex items-center`}
                                  title={`Комнаты: ${roomsText}`}
                                >
                                  {roomsText}: {rooms.length}{" "}
                                  {rooms.length === 1
                                    ? "комната"
                                    : rooms.length > 1 && rooms.length < 5
                                      ? "комнаты"
                                      : "комнат"}
                                </span>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    }
                  >
                    {/* Содержимое аккордеона (детальная информация) */}
                    <div className="border-t border-primary-100 p-3 bg-primary-50/50">
                      {/* Информация о команде */}
                      {assignment.team_size &&
                        assignment.team_size > 1 &&
                        assignment.team_members && (
                          <div className="mb-3">
                            <h4 className="text-[11px] font-medium text-green-700 mb-1.5">
                              Состав команды:
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {assignment.team_members.map((member) => (
                                <div
                                  key={`team-member-${member}`}
                                  className="flex items-center bg-white px-2 py-1 rounded-full border border-green-100"
                                >
                                  <div className="flex-shrink-0">
                                    <EmployeeAvatar name={member} size="md" />
                                  </div>
                                  <span className="text-xs text-primary-800 ml-1">
                                    {member}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Блок с распределением времени */}
                      <div className="mb-3">
                        <h4 className="text-[11px] font-medium text-primary-700 mb-1.5">
                          Расчет времени:
                        </h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Время задач:</span>{" "}
                            <span>
                              {assignment.total_task_time.toFixed(1)} мин.
                            </span>
                          </div>

                          {/* Время переходов с информацией о дополнительном времени без тележки */}
                          <div className="flex justify-between">
                            <span>
                              {(() => {
                                // Проверяем, есть ли комнаты без склада у работника без тележки
                                const hasRoomsWithoutStorage =
                                  !assignment.needs_trolley &&
                                  assignment.tasks.some(
                                    (task) => !doesRoomHaveStorage(task.room),
                                  );

                                return hasRoomsWithoutStorage
                                  ? "Время переходов (+работа без тележки):"
                                  : "Время переходов:";
                              })()}
                            </span>
                            <span>
                              {assignment.total_transition_time} мин.
                              {(() => {
                                // Подсчитываем дополнительное время из-за работы без тележки
                                if (!assignment.needs_trolley) {
                                  const roomsWithoutStorage =
                                    assignment.tasks.filter(
                                      (task) => !doesRoomHaveStorage(task.room),
                                    ).length;

                                  if (roomsWithoutStorage > 0) {
                                    const additionalTime =
                                      roomsWithoutStorage * 3;

                                    return ` (+${additionalTime} мин.)`;
                                  }
                                }

                                return "";
                              })()}
                            </span>
                          </div>

                          {assignment.team_size && assignment.team_size > 1 && (
                            <div className="flex justify-between text-green-600 font-medium">
                              <span>Эффективность команды:</span>
                              <span>
                                ×{assignment.efficiency_factor?.toFixed(1)}
                              </span>
                            </div>
                          )}
                          {/* Показываем перерыв только если он был добавлен */}
                          {assignment.break_time_added > 0 && (
                            <div className="flex justify-between text-blue-600">
                              <span>Перерыв (10:45-11:00):</span>{" "}
                              <span>+ {assignment.break_time_added} мин.</span>
                            </div>
                          )}
                          {/* Итоговое время с указанием овертайма */}
                          <div
                            className={`flex justify-between font-semibold border-t border-dashed border-primary-200 pt-1 mt-1 ${assignment.is_overtime ? "text-red-600" : "text-primary-800"}`}
                          >
                            <span>Итоговое время:</span>
                            <span>
                              {assignment.total_effective_time.toFixed(1)} мин.
                            </span>
                          </div>
                          {/* Расчетное время окончания */}
                          <div
                            className={`flex justify-between text-xs ${assignment.is_overtime ? "text-red-600 font-semibold" : "text-gray-600"}`}
                          >
                            <span>Ожид. окончание:</span>
                            <span>{assignment.estimated_finish_time_str}</span>
                          </div>
                        </div>
                      </div>

                      {/* Блок с деталями заданий */}
                      <h4 className="text-[11px] font-medium text-primary-700 mb-1.5 mt-3 border-t border-primary-100 pt-2">
                        Детали заданий ({assignment.tasks.length}):
                      </h4>
                      {/* Контейнер с прокруткой для списка задач */}
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {/* Группируем задания по коридорам для вывода */}
                        {(() => {
                          const tasksByCorridors: Record<
                            string,
                            AssignedTask[]
                          > = {};

                          // Группируем задачи по ключу коридора
                          assignment.tasks.forEach((task) => {
                            const corridorKey = task.corridor
                              ? `Коридор ${task.corridor}`
                              : "Прочее";

                            if (!tasksByCorridors[corridorKey]) {
                              tasksByCorridors[corridorKey] = [];
                            }
                            tasksByCorridors[corridorKey].push(task);
                          });

                          // Сортируем ключи коридоров (числовые сначала, потом 'Прочее')
                          const sortedCorridorKeys = Object.keys(
                            tasksByCorridors,
                          ).sort((a, b) => {
                            const numA = parseInt(a.replace("Коридор ", ""));
                            const numB = parseInt(b.replace("Коридор ", ""));

                            if (!isNaN(numA) && !isNaN(numB))
                              return numA - numB;
                            if (!isNaN(numA)) return -1;
                            if (!isNaN(numB)) return 1;

                            return a.localeCompare(b);
                          });

                          // Отображаем группы задач
                          return sortedCorridorKeys.map((corridorKey) => (
                            <div key={corridorKey} className="mb-1">
                              {/* Заголовок группы коридора */}
                              <div className="text-[10px] font-semibold text-primary-600 mb-1 px-1 sticky top-0 bg-primary-100/80 backdrop-blur-sm py-0.5 rounded-sm z-10">
                                {corridorKey} (
                                {tasksByCorridors[corridorKey].length} задач)
                              </div>
                              {/* Список задач в группе */}
                              {tasksByCorridors[corridorKey].map((task, i) => {
                                // Находим оригинальный RoomTask для получения полного набора данных (для getRowColor)
                                const originalTask = roomTasks.find(
                                  (rt) => rt.room === task.room,
                                );
                                // Если оригинальная задача не найдена, создаем минимальный объект RoomTask с коридором
                                const taskForColor: RoomTask = originalTask
                                  ? originalTask
                                  : {
                                      room: task.room,
                                      corridor: task.corridor,
                                      type: "",
                                      note: "",
                                    };

                                return (
                                  <div
                                    key={`${task.room}-${i}`}
                                    className="flex items-center justify-between bg-white p-1.5 rounded border border-primary-100 text-xs ml-1 hover:border-primary-300"
                                  >
                                    {/* Левая часть: номер комнаты и описание */}
                                    <div className="flex items-center overflow-hidden mr-2">
                                      {/* Номер комнаты */}
                                      <span
                                        className={`font-medium w-6 text-center flex-shrink-0 ${getRowColor(taskForColor).replace("bg-", "text-").replace("-50", "-800")}`}
                                        title={`Room ${task.room}`}
                                      >
                                        {task.room}
                                      </span>
                                      {/* Тип задачи */}
                                      {originalTask?.type && (
                                        <span
                                          className={`mx-1 flex-shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${
                                            originalTask.type === "V"
                                              ? "bg-blue-100 text-blue-800"
                                              : originalTask.type === "B"
                                                ? "bg-green-100 text-green-800"
                                                : originalTask.type === "N"
                                                  ? "bg-orange-100 text-orange-800"
                                                  : originalTask.type === "V/N"
                                                    ? "bg-purple-100 text-purple-800"
                                                    : "bg-gray-100 text-gray-800"
                                          }`}
                                          title={getTaskTypeName(
                                            originalTask.type,
                                          )}
                                        >
                                          {originalTask.type}
                                        </span>
                                      )}
                                      {/* Описание задачи с title для полного текста */}
                                      <span
                                        className="text-primary-700 ml-1.5 truncate"
                                        title={task.description}
                                      >
                                        {task.description}
                                      </span>
                                    </div>
                                    {/* Правая часть: время задачи */}
                                    <span
                                      className="font-medium text-primary-800 ml-1 flex-shrink-0"
                                      title={
                                        task.raw_estimated_time
                                          ? `Изначально: ${task.raw_estimated_time} мин.`
                                          : ""
                                      }
                                    >
                                      {task.estimated_time.toFixed(1)} мин.
                                      {task.raw_estimated_time &&
                                        task.raw_estimated_time !==
                                          task.estimated_time && (
                                          <span className="text-green-600 ml-1 text-[9px]">
                                            (из {task.raw_estimated_time})
                                          </span>
                                        )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </AccordionItem>
                ))}
            </Accordion>

            {/* Предупреждение о тележках и овертайме */}
            {(assignments.too_many_trolleys ||
              assignments.assignments.some((a) => a.is_overtime)) && (
              <div className="mt-3 p-2 bg-yellow-100 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                {assignments.too_many_trolleys && (
                  <p className="font-medium mb-1 flex items-center">
                    <svg
                      className="h-4 w-4 mr-1 flex-shrink-0 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    <span>
                      Внимание: Требуется более 2 тележек. Назначены сотрудникам
                      с наибольшим количеством комнат без склада. Остальным
                      добавлено время (+3 мин/комната).
                    </span>
                  </p>
                )}
                {assignments.assignments.some((a) => a.is_overtime) && (
                  <p className="font-medium">
                    Внимание: сотрудники могут не успеть до 15:00.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
