"use client";

import { useState, useEffect } from "react";

export const Clock = () => {
  const [dateTime, setDateTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Устанавливаем флаг клиентского рендеринга
    setIsClient(true);

    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Форматируем дату: день недели, число месяц год
  const formattedDate = dateTime.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Форматируем время: часы:минуты:секунды
  const formattedTime = dateTime.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Более короткая дата для мобильных устройств
  const shortDate = dateTime.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "numeric",
  });

  // Показываем пустой контейнер во время серверного рендеринга
  if (!isClient) {
    return (
      <div className="flex flex-col items-end rounded-lg px-2 sm:px-3 py-0.5 sm:py-1 bg-primary-50 border border-primary-200 shadow-sm">
        <div className="text-primary-800 font-medium text-[10px] sm:text-xs md:text-sm capitalize hidden sm:block">
          &nbsp;
        </div>
        <div className="text-primary-600 font-bold text-xs sm:text-sm md:text-base flex items-center">
          <span className="inline-block w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-secondary-500 mr-1 sm:mr-1.5" />
          &nbsp;
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end rounded-lg px-2 sm:px-3 py-0.5 sm:py-1 bg-primary-50 border border-primary-200 shadow-sm">
      <div className="text-primary-800 font-medium text-[10px] sm:text-xs md:text-sm capitalize hidden sm:block">
        {formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}
      </div>
      <div className="text-primary-600 font-bold text-xs sm:text-sm md:text-base flex items-center">
        <span className="inline-block w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-secondary-500 mr-1 sm:mr-1.5 animate-pulse" />
        {formattedTime}
      </div>
    </div>
  );
};
