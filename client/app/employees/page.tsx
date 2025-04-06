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
import { Switch } from "@heroui/react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { useDisclosure } from "@heroui/react";
import { Chip } from "@heroui/react";

import api from "../../services/api";

import { title } from "@/components/primitives";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await api.employees.getAllEmployees();

      setEmployees(data.employees || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWorking = async (name) => {
    try {
      await api.employees.toggleEmployeeWorking(name);
      fetchEmployees();
    } catch (error) {
      console.error("Error toggling employee status:", error);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.trim()) return;

    try {
      await api.employees.addEmployee(newEmployee.trim());
      setNewEmployee("");
      onClose();
      fetchEmployees();
    } catch (error) {
      console.error("Error adding employee:", error);
    }
  };

  const handleDeleteEmployee = async (name) => {
    try {
      await api.employees.deleteEmployee(name);
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className={title()}>Employees Management</h1>
        <Button color="primary" onPress={onOpen}>
          Add Employee
        </Button>
      </div>

      <div className="bg-content1 p-6 rounded-lg shadow">
        <Table aria-label="Employees table">
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>ACTIONS</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No employees found" isLoading={isLoading}>
            {employees.map((employee) => (
              <TableRow key={employee.name}>
                <TableCell>{employee.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      isSelected={employee.istodayworking}
                      onChange={() => handleToggleWorking(employee.name)}
                    />
                    <Chip
                      color={employee.istodayworking ? "success" : "default"}
                      variant="flat"
                    >
                      {employee.istodayworking ? "Working" : "Off"}
                    </Chip>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    color="danger"
                    size="sm"
                    variant="light"
                    onClick={() => handleDeleteEmployee(employee.name)}
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
          <ModalHeader>Add New Employee</ModalHeader>
          <ModalBody>
            <Input
              label="Employee Name"
              placeholder="Enter employee name"
              value={newEmployee}
              onChange={(e) => setNewEmployee(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleAddEmployee}>
              Add Employee
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
