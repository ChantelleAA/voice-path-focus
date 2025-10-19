import { Task } from '@/types/task';

const STORAGE_KEY = 'voicepath_tasks';

export const getTasks = (): Task[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveTasks = (tasks: Task[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};

export const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
  const tasks = getTasks();
  const newTask: Task = {
    ...task,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tasks.push(newTask);
  saveTasks(tasks);
  return newTask;
};

export const updateTask = (id: string, updates: Partial<Task>) => {
  const tasks = getTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return null;
  
  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: Date.now(),
  };
  saveTasks(tasks);
  return tasks[index];
};

export const deleteTask = (id: string) => {
  const tasks = getTasks();
  const filtered = tasks.filter(t => t.id !== id);
  saveTasks(filtered);
};

export const getTaskById = (id: string): Task | null => {
  const tasks = getTasks();
  return tasks.find(t => t.id === id) || null;
};
