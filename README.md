# ddiary

A personal diabetes diary and retrospective analytics application for people living with **Type 1 Diabetes (T1D)**.

`ddiary` brings together blood glucose readings, meals, insulin doses, and physical activity into a single unified timeline so you can see the full picture and retrospectively analyze how your body responds to insulin, food, and exercise.

> **Medical Disclaimer:** `ddiary` is a personal data logging and retrospective analysis tool. It is **not** a medical device, does not provide medical advice, and must not be used for automated insulin dosing or clinical decision-making. Always consult your healthcare provider before adjusting your therapy.

---

## Project Overview

Managing T1D involves balancing many interacting factors every day. Data is often scattered across separate apps (CGM viewers, smart pen apps, fitness trackers, food logs), making it hard to spot patterns.

`ddiary` aims to solve this by:
1. **Aggregating all relevant signals** — glucose, nutrition, insulin, and biometrics — into one place.
2. **Reducing logging friction** — using NFC pen reads, Health Connect sync, CGM/Nightscout integrations, and photo-based AI meal estimation.
3. **Enabling retrospective self-analysis** — correlating meals, insulin, and activity with glucose curves to understand your personal parameters over time.

---

## Core Features

### 1. Blood Glucose Tracking & Visualization
- **Multiple Data Sources** *(designed to stay extensible and up to date)*:
  - **Manual entry** from a blood glucose meter (glucometer / fingerstick).
  - **CGM data** (direct or companion integrations, e.g., Dexcom, FreeStyle Libre / LibreLinkUp, xDrip+, Juggluco).
  - **Third-party health & diabetes platforms**, including **Google Health Connect** and **Nightscout**.
- **Interactive Glucose Chart**: View historical glucose curves across customizable time ranges, overlaid with meals, insulin doses, and physical activity events.

### 2. Meal & Nutrition Logging (with AI Photo Analysis)
- Log **what** and **when** you ate, including:
  - Meal description
  - Carbohydrates (g), fat (g), and protein (g)
  - **Automatic calorie (kcal) calculation** derived from macronutrients (`4 kcal/g` carbs, `4 kcal/g` protein, `9 kcal/g` fat)
- **AI-Assisted Meal Estimation**: Take or attach a photo of a meal to send to an external multimodal LLM, which analyzes the image and returns a meal description and estimated carbs, fat, protein, and calories for you to review and save.

### 3. Insulin Logging
- Record insulin administrations with **timestamp**, **insulin type** (e.g., rapid-acting / bolus, long-acting / basal), and **dose (units)**.
- **Input Methods**:
  - **Manual entry**
  - **NFC Smart Pen reading** directly via phone NFC (e.g., compatible smart insulin pens such as NovoPen 6 / NovoPen Echo Plus)

### 4. Physical Activity & Biometrics
- Automatically collect physical health data available in **Google Health Connect**, including:
  - Heart rate
  - Steps
  - Workouts and other available physical activity metrics

### 5. Retrospective Personal Analysis
Using the combined timeline of glucose, meals, insulin, and physical activity, `ddiary` helps you retrospectively inspect and refine your personal parameters, such as:
- **Insulin Sensitivity (ISS / ISF)** across different times of day or activity levels
- **Insulin timings** (onset, peak action, duration, and pre-bolus timing)
- **Meal impact & glycemic response** (how specific foods and carb/fat/protein ratios affect glucose peaks, timing, and delayed rises)
- **Exercise & heart-rate effects** on glucose trends during and after activity

---

## Project Status

`ddiary` is in early planning and design. Next steps include:
- Defining platform & technology stack (mobile app, backend/sync, storage, LLM integration)
- Designing the unified data model for glucose, meals, insulin, and biometrics
- Planning the MVP scope and initial data source integrations
