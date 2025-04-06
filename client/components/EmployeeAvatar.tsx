import React, { useState } from "react";
import Image from "next/image";

type EmployeeAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Компонент для отображения аватара сотрудника
 * Загружает изображения с использованием fallback на инициалы в случае ошибки
 */
export default function EmployeeAvatar({
  name,
  size = "md",
  className = "",
}: EmployeeAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Получаем инициалы из имени для fallback
  const getInitials = (name: string) => {
    const parts = name.split(/[ ,]+/); // разделяем по пробелам и запятым

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return name.substring(0, 2).toUpperCase();
  };

  // Генерируем цвет на основе имени для fallback
  const getColorFromName = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-emerald-500",
      "bg-purple-500",
      "bg-amber-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-rose-500",
      "bg-sky-500",
      "bg-lime-500",
      "bg-fuchsia-500",
      "bg-teal-500",
      "bg-orange-500",
    ];

    // Простой хеш для выбора цвета
    let hash = 0;

    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;

    return colors[index];
  };

  // Определяем размеры в зависимости от параметра size
  const sizeClasses = {
    sm: "w-5 h-5 text-[8px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  // Определяем размеры для image fill
  const imageSizes = {
    sm: "20px",
    md: "32px",
    lg: "40px",
  };

  // Если это команда с несколькими сотрудниками - всегда используем инициалы
  const isTeam = name.toLowerCase().includes("команда");

  if (isTeam || imgError) {
    // Для команд или при ошибке загрузки изображения показываем инициалы
    return (
      <div
        className={`${sizeClasses[size]} ${isTeam ? "bg-primary-500" : getColorFromName(name)} rounded-full flex items-center justify-center text-white font-medium ${className}`}
        title={name}
      >
        {getInitials(name)}
      </div>
    );
  } else {
    // Для обычных сотрудников пытаемся загрузить изображение
    return (
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden relative ${className}`}
        title={name}
      >
        <Image
          fill
          alt={name}
          className="object-cover w-full h-full"
          sizes={imageSizes[size]}
          src={`/img/${name}.png`}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
}
