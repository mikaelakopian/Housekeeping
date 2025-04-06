import uvicorn
import subprocess
import sys
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import logging

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("schedule_runner")

def run_scrape_schedule():
    """Запускает скрипт scrape_schedule.py"""
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scrape_schedule.py")
    logger.info(f"Запуск скрипта обновления расписания: {script_path}")
    
    try:
        # Запускаем скрипт как подпроцесс
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            check=True
        )
        logger.info(f"Скрипт успешно выполнен. Вывод: {result.stdout}")
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка при выполнении скрипта: {e}")
        logger.error(f"Вывод stderr: {e.stderr}")
    except Exception as e:
        logger.error(f"Непредвиденная ошибка: {e}")

def setup_scheduler():
    """Настраивает планировщик для запуска скрипта ежедневно в 21:45"""
    scheduler = BackgroundScheduler()
    
    # Добавляем задание на выполнение скрипта в 21:45 каждый день
    scheduler.add_job(
        run_scrape_schedule,
        trigger=CronTrigger(hour=21, minute=45),
        id="scrape_schedule_job",
        replace_existing=True,
    )
    
    # Для тестирования: добавляем задание, которое будет запускаться через минуту после старта сервера
    current_time = datetime.now()
    test_minute = (current_time.minute + 1) % 60
    scheduler.add_job(
        run_scrape_schedule,
        trigger=CronTrigger(hour=current_time.hour, minute=test_minute),
        id="test_scrape_job",
        replace_existing=True,
    )
    
    logger.info(f"Запланировано ежедневное выполнение scrape_schedule.py в 21:45")
    logger.info(f"Также запланировано тестовое выполнение scrape_schedule.py через минуту в {current_time.hour}:{test_minute}")
    
    # Запускаем планировщик
    scheduler.start()
    return scheduler

if __name__ == "__main__":
    # Настраиваем и запускаем планировщик
    scheduler = setup_scheduler()
    
    # Запускаем Uvicorn сервер
    logger.info("Запуск FastAPI сервера...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 