import json
import re
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.chrome.service import Service as ChromeService 
# If using webdriver-manager (recommended):
from webdriver_manager.chrome import ChromeDriverManager
# Import BeautifulSoup
from bs4 import BeautifulSoup

# --- Configuration ---
LOGIN_URL = "https://tatenhove.nostradamus.nu/index.php?option=com_users&Itemid=2&office_id=1"
SCHEDULE_PAGE_URL = "https://tatenhove.nostradamus.nu/index.php?option=com_planning&controller=weekrosters&Itemid=2&office_id=1"
BASE_URL = "https://tatenhove.nostradamus.nu/"
USERNAME = "mikael.akopyan@gmail.com"
PASSWORD = "Greedisgood0017!!!" # Consider using env variables or secure config
OUTPUT_FILE = "schedule.json"
# Optional: Specify path if chromedriver is not in PATH and not using webdriver-manager
# WEBDRIVER_PATH = '/path/to/your/chromedriver' 
WEBDRIVER_PATH = None # Set to None when using webdriver-manager

def extract_schedule_url(onclick_attr):
    """Extracts the relative URL from the window.open onclick attribute."""
    match = re.search(r"window\.open\('([^']+)'", onclick_attr)
    if match:
        # Replace HTML entities and return full URL
        relative_url = match.group(1).replace('&amp;', '&')
        return BASE_URL + relative_url
    return None

def main():
    driver = None
    all_schedule_data = {}
    try:
        # --- Initialize WebDriver ---
        print("Initializing WebDriver...")
        options = webdriver.ChromeOptions()
        # Common options for stability
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080') 
        options.add_argument('--no-sandbox') # Often needed in containerized environments
        options.add_argument('--disable-dev-shm-usage') # Overcomes limited resource problems
        options.add_argument('--headless') # Uncomment to run without opening a browser window

        # Use webdriver-manager
        print("Setting up ChromeDriver using webdriver-manager...")
        service=ChromeService(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        print("WebDriver initialized successfully.")


        # Implicit wait might be less necessary with explicit waits, but can keep it low
        driver.implicitly_wait(2) 

        # --- Login ---
        print(f"Navigating to login page: {LOGIN_URL}")
        driver.get(LOGIN_URL)
        
        print("Entering credentials...")
        # Use correct ID and increased wait time
        WebDriverWait(driver, 20).until(EC.visibility_of_element_located((By.ID, "ja_username"))).send_keys(USERNAME)
        # Use correct ID
        driver.find_element(By.ID, "ja_password").send_keys(PASSWORD)
        
        print("Submitting login form...")
        # Use correct ID for login button
        try:
            login_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, "ja_submit")))
            login_button.click()
            print("Login submitted.")
        except (NoSuchElementException, TimeoutException) as e:
            print(f"ERROR: Could not find or click login button (ID: ja_submit). {e}")
            return # Cannot proceed

        # Wait for potential redirect or dashboard element after login
        # Use an explicit wait for a known element on the *next* page instead of time.sleep
        try:
             WebDriverWait(driver, 15).until(
                 EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='com_planning&controller=weekrosters']")) # Wait for a link to the schedule page
             )
             print("Successfully logged in.")
        except TimeoutException:
             print("ERROR: Timed out waiting for element after login. Login may have failed.")
             # Optionally save screenshot
             # driver.save_screenshot("post_login_error.png")
             return


        # --- Navigate to Schedule Page ---
        print(f"Navigating to schedule page: {SCHEDULE_PAGE_URL}")
        driver.get(SCHEDULE_PAGE_URL)

        # Explicitly wait for the schedule table overview
        print("Waiting for schedule overview table to load...")
        try:
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.XPATH, "//table[contains(@class, 'table-striped')]//a[contains(@onclick, 'index2.php?task=view')]")) # Wait for the links within the table
            )
            print("Schedule overview table loaded.")
        except TimeoutException:
            print("ERROR: Timed out waiting for schedule overview table. Page structure changed or navigation failed.")
            # driver.save_screenshot("schedule_overview_error.png")
            return

        # --- Find Schedule Links and Years ---
        print("Finding schedule links and extracting years...")
        schedule_urls_with_year = []
        try:
            # Find rows with schedule links more robustly
            link_elements = driver.find_elements(By.XPATH, "//table[contains(@class, 'table-striped')]//a[contains(@onclick, 'index2.php?task=view')]")
            
            if not link_elements:
                 print("Warning: Found schedule overview table but no schedule links found.")

            for link_element in link_elements:
                try:
                    onclick_attr = link_element.get_attribute('onclick')
                    schedule_url = extract_schedule_url(onclick_attr)
                    link_text = link_element.text # e.g., "14 - 2025"
                    
                    # Extract year reliably
                    year_match = re.search(r'\b(\d{4})\b', link_text)
                    year = year_match.group(1) if year_match else None

                    if schedule_url and year:
                        schedule_urls_with_year.append({"url": schedule_url, "year": year})
                        # print(f"  Found: {schedule_url} (Year: {year})") # Debug print
                    else:
                        print(f"  Warning: Could not extract URL or year from link: {link_text} | {onclick_attr}")
                except Exception as e:
                     print(f"  Error processing link element: {e}")

        except Exception as e: # Catch broader errors during link finding
             print(f"Error finding schedule links: {e}")
             return


        print(f"Found {len(schedule_urls_with_year)} schedule links to process.")

        # --- Iterate Through Weeks ---
        for item in schedule_urls_with_year:
            schedule_url = item["url"]
            year = item["year"]
            print(f"Processing schedule: {schedule_url} (Year: {year})")

            try:
                # Navigate directly to the schedule URL
                driver.get(schedule_url)
                # Wait for the table to be present using Selenium
                weekly_table_element = WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.XPATH, "//table[contains(@class, 'table-striped') and contains(@class, 'table-hover')]"))
                )

                # --- Use BeautifulSoup for Parsing ---
                # Get the HTML of the table element
                table_html = weekly_table_element.get_attribute('outerHTML')
                # Use lxml parser
                soup = BeautifulSoup(table_html, 'lxml')

                # Find tbody and rows using BeautifulSoup
                table_body = soup.find('tbody')
                if not table_body:
                     print("  ERROR: Could not find tbody in table HTML. Skipping week.")
                     continue
                
                all_rows = table_body.find_all('tr')
                if not all_rows:
                    print("  ERROR: Found table body but no rows inside. Skipping week.")
                    continue
                
                # --- Parse Header Row (using BS4) ---
                header_row = all_rows[0]
                header_cells = header_row.find_all('th')
                
                date_columns = {}
                # print("Header Cells Found:", len(header_cells)) # Debug
                for i, cell in enumerate(header_cells):
                    if i == 0: continue # Skip first cell (&nbsp;)
                    cell_text = cell.get_text(strip=True)
                    match = re.search(r'\(\s*(\d{1,2}-\d{1,2})\s*\)', cell_text)
                    if match:
                        day_month = match.group(1)
                        parts = day_month.split('-')
                        formatted_date = f"{int(parts[0]):02d}-{int(parts[1]):02d}-{year}"
                        date_columns[i] = formatted_date
                        # print(f"    Mapped index {i} to date: {formatted_date}") # Debug
                    else:
                        print(f"    Warning: Could not parse date from header cell: {cell_text}")

                if not date_columns:
                     print("  ERROR: No dates found in schedule table header. Skipping this week.")
                     continue

                # --- Process Employee Rows (using BS4) ---
                employee_rows = all_rows[1:] 
                # print(f"  Found {len(employee_rows)} employee rows (using BS4).") # Debug

                for row in employee_rows:
                    cells = row.find_all('td')
                    if not cells or len(cells) < 2: 
                        # print("  Skipping BS4 row, not enough cells or not a data row.") # Debug
                        continue 

                    # Extract employee name (simpler BS4 extraction)
                    employee_name = ""
                    try:
                        employee_name_cell = cells[0]
                        # Check for bold tag first
                        bold_tag = employee_name_cell.find('b')
                        if bold_tag:
                            employee_name = bold_tag.get_text(strip=True)
                        else:
                            # Get text, excluding potential tooltip span content (less reliable than JS, but faster)
                            tooltip_span = employee_name_cell.find('span', attrs={'data-toggle': 'tooltip'})
                            if tooltip_span:
                                tooltip_span.extract() # Remove the span from the parse tree
                            employee_name = employee_name_cell.get_text(strip=True)

                    except Exception as name_ex:
                        print(f"  ERROR extracting employee name (BS4): {name_ex}. Row HTML: {cells[0]}")
                        continue

                    if not employee_name:
                        # print("  Skipping row, empty employee name after BS4 processing.") # Debug
                        continue
                    print(f"  Processing employee: {employee_name}") # Log employee being processed

                    # Iterate through the map of column indices and dates
                    for col_index, full_date_str in date_columns.items():
                        if col_index < len(cells):
                            day_cell = cells[col_index]
                            try:
                                # --- Updated BS4 Check for \"Housekeeping\" ---
                                # Get all text within the cell, join it, and check case-insensitively
                                cell_text_content = ' '.join(day_cell.stripped_strings).lower()
                                
                                if 'housekeeping' in cell_text_content:
                                # ---------------------------------------------
                                    print(f"    Found Housekeeping for {employee_name} on {full_date_str}") # Log found shift
                                    if full_date_str not in all_schedule_data:
                                        all_schedule_data[full_date_str] = []
                                    if employee_name not in all_schedule_data[full_date_str]:
                                        all_schedule_data[full_date_str].append(employee_name)
                            except Exception as cell_ex:
                                 print(f"    Error checking cell with BS4 for {employee_name} on {full_date_str}: {cell_ex}")
                        # else: # Debugging index issues
                        #     print(f"    Warning: Column index {col_index} out of range for BS4 row (cells: {len(cells)})")


            except (TimeoutException, NoSuchElementException) as e:
                print(f"  Selenium Error locating table for {schedule_url}: {e}")
            except Exception as e:
                print(f"  An unexpected error occurred processing week {schedule_url}: {e}") # Catch broader errors per week

            # Shorter delay needed now? Can keep it or reduce slightly.
            # time.sleep(0.2) # Removed delay as lxml should be faster

        # --- Sort and Save to JSON ---
        print(f"Saving data for {len(all_schedule_data)} dates to {OUTPUT_FILE}")
        
        # Sort data by date (DD-MM-YYYY format requires custom sort key)
        try:
             # Sort key function: converts 'DD-MM-YYYY' to (YYYY, MM, DD) tuple for correct sorting
             def date_sort_key(date_str):
                 d, m, y = map(int, date_str.split('-'))
                 return (y, m, d)

             sorted_schedule_data = dict(sorted(all_schedule_data.items(), key=lambda item: date_sort_key(item[0])))
        except Exception as sort_error:
             print(f"Error sorting dates: {sort_error}. Saving unsorted.")
             sorted_schedule_data = all_schedule_data


        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(sorted_schedule_data, f, ensure_ascii=False, indent=4)

        print("Scraping completed successfully.")

    except Exception as e:
        print(f"An overall error occurred: {e}")
        # Print stack trace for debugging if needed
        # import traceback
        # traceback.print_exc()
    finally:
        if driver:
            driver.quit()
            print("WebDriver closed.")

if __name__ == "__main__":
    main()