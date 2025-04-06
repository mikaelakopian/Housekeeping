"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { Input } from "@heroui/react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { useDisclosure } from "@heroui/react";
import { Textarea } from "@heroui/react";

import api from "../../services/api";

import { title } from "@/components/primitives";

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    room: "",
    price: 0,
    description: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const data = await api.tasks.getAllTasks();

      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.room.trim()) return;

    try {
      await api.tasks.addTask(newTask);
      setNewTask({ room: "", price: 0, description: "" });
      onClose();
      fetchTasks();
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleDeleteTask = async (room) => {
    try {
      await api.tasks.deleteTask(room);
      fetchTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setNewTask((prev) => ({
      ...prev,
      [name]: name === "price" ? Number(value) : value,
    }));
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className={title()}>Tasks Management</h1>
        <Button color="primary" onPress={onOpen}>
          Add Task
        </Button>
      </div>

      <div className="bg-content1 p-6 rounded-lg shadow">
        <Table aria-label="Tasks table">
          <TableHeader>
            <TableColumn>ROOM</TableColumn>
            <TableColumn>PRICE</TableColumn>
            <TableColumn>DESCRIPTION</TableColumn>
            <TableColumn>ACTIONS</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No tasks found" isLoading={isLoading}>
            {tasks.map((task) => (
              <TableRow key={task.room}>
                <TableCell>{task.room}</TableCell>
                <TableCell>${task.price}</TableCell>
                <TableCell>
                  <div className="max-w-xs truncate">
                    {task.description || "No description"}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    color="danger"
                    size="sm"
                    variant="light"
                    onClick={() => handleDeleteTask(task.room)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Add New Task</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Room Number"
                name="room"
                placeholder="Enter room number"
                value={newTask.room}
                onChange={handleInputChange}
              />
              <Input
                label="Price"
                name="price"
                placeholder="Enter price"
                type="number"
                value={newTask.price}
                onChange={handleInputChange}
              />
              <Textarea
                label="Description"
                name="description"
                placeholder="Enter task description"
                value={newTask.description}
                onChange={handleInputChange}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleAddTask}>
              Add Task
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
