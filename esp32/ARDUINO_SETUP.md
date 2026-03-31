# Arduino IDE Setup Guide for ESP32

This guide walks you through setting up the Arduino IDE to compile and upload the firmware for the Smart Control ESP32 project.

## 1. Install Arduino IDE
If you haven't already, download and install the latest [Arduino IDE](https://www.arduino.cc/en/software).

## 2. Add ESP32 Board Support
1. Open the Arduino IDE.
2. Go to **File** > **Preferences** (on Windows/Linux) or **Arduino IDE** > **Preferences** (on macOS).
3. Find the field labeled **Additional Boards Manager URLs** at the bottom of the window.
4. Paste the following URL into the field (if there are URLs already there, separate them with a comma):
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
5. Click **OK**.

## 3. Install the ESP32 Package
1. On the left sidebar, click the **Boards Manager** icon (or go to **Tools** > **Board** > **Boards Manager...**).
2. In the Boards Manager search bar, type `esp32`.
3. Locate the `esp32` package by **Espressif Systems** and click **Install**. *(This might take a few minutes to download).*

## 4. Install Required Libraries
This project relies on the **ArduinoJson** library. The networking libraries (`WiFi`, `WiFiMulti`, `WebServer`, `ESPmDNS`) are built-in and already included when you installed the ESP32 board package in the previous step.

1. On the left sidebar, click the **Library Manager** icon (or go to **Sketch** > **Include Library** > **Manage Libraries...**).
2. In the Library Manager search bar, type `ArduinoJson`.
3. Locate **ArduinoJson by Benoit Blanchon**.
4. IMPORTANT: Select a version starting with **6.** (for example, `6.21.5`) from the dropdown and click **Install**. Please avoid version 7 for now, as the API has differences.

## 5. Select Your Board and Port
1. Connect your ESP32 board to your computer via a micro-USB or USB-C cable (ensure it's a data-sync cable, not just a charging cable).
2. Go to **Tools** > **Board** > **esp32** and select your specific ESP32 board model. If you are unsure, **ESP32 Dev Module** is a safe default for most generic boards.
3. Go to **Tools** > **Port** and select the COM port (Windows) or `/dev/cu.usbserial-*` / `/dev/cu.SLAB_USBtoUART` (macOS) corresponding to your ESP32.

## 6. Open the Project and Upload
1. In the Arduino IDE, go to **File** > **Open...**
2. Navigate to this repository and select the `esp32/main/main.ino` file.
   - *Note: The Arduino IDE requires the source code to live in a folder of the exact same name as the `.ino` file. That's why the code is inside the `main` directory!*
3. Before uploading, make sure you configure your Wi-Fi credentials inside the `config.h` file. You can see it as a tab at the top of the Arduino IDE editor window.
4. Click the **Upload** button (the right-pointing arrow `➔`) at the top left of the IDE.
5. Wait for the code to compile and upload. You'll see "Done uploading." in the bottom output window.
   - *If the upload fails while showing "Connecting...", try holding down the physical "BOOT" button on the ESP32 board when you see the `. . . . .` appearing in the terminal.*

## 7. Verify Setup
1. Open the **Serial Monitor** (the magnifying glass icon in the top right, or **Tools** > **Serial Monitor**).
2. In the dropdown at the top right of the Serial Monitor, set the baud rate to **115200 baud**.
3. Press the physical `EN` (or `RST`) button on your ESP32 to restart it.
4. Watch the Serial Monitor. You should see it initializing, connecting to your Wi-Fi, and finally printing the Local IP it was assigned!
