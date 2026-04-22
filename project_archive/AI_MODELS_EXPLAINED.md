# AgileAI: Machine Learning Models & Evaluation Metrics 🤖
**A Layman's Guide to Our AI Engine**

This document explains the two Artificial Intelligence models used in our project, how they function in simple terms, and the specific metrics we use to evaluate if they are actually doing a good job.

---

## 1. What does the AI actually do in our project?
Instead of just being a digital sticky-note board like Trello, AgileAI acts as a smart assistant for the Project Manager. 

It does two things:
1. **Predicts if a Sprint will fail** before it even starts.
2. **Guesses how much effort (Story Points)** a single task will take so developers don't have to guess.

To do this, we use a very popular machine learning method called **XGBoost** (Extreme Gradient Boosting). Instead of a Deep Neural Network (which works well for images and text), XGBoost works like a highly advanced series of decision-making flowcharts. It is the industry standard for spreadsheet-like (tabular) data.

---

## 2. Model 1: The Sprint Risk Predictor
**Technical Name:** XGBoost Classifier
**Job:** To look at a planned sprint and say "Yes, this will succeed" or "No, this is highly likely to fail/be delayed."

### How it works (In Layman's Terms)
Imagine you are planning a road trip. If you look at a map and see 5 traffic jams, 3 roadblocks, and you change your destination 4 times, you will probably be late. 
Our AI does the exact same thing but for software code. When a Project Manager puts tasks into a Sprint, the AI calculates:
* How many tasks depend on other unfinished tasks? (*Blocked Ratio*)
* How many tasks are marked "Critical"? (*Priority Ratio*)
* How often is the project manager changing task descriptions? (*Churn Ratio*)

If the combination of these ratios historically led to failure in huge projects (like Apache or MongoDB), our AI raises a red flag.

### How We Evaluate It (The Metric/Matrix)
**Metric Used:** `Macro F1-Score`

**Why not just use "Accuracy"?**
If 90 out of 100 historical sprints were successful, a dumb AI could just guess "Success" every single time and be 90% accurate! But it would be useless at catching the 10 failures. 

**What is Macro F1-Score?**
The F1-Score is a strict grading system. It combines two things:
1. **Precision:** When the AI cries "Failure!", is it actually a failure? Or is it a false alarm?
2. **Recall:** Out of all the *real* failures that happened, how many did the AI successfully catch?

The *Macro* part means we grade the AI on how well it predicts Success AND how well it predicts Failure, and average those two grades equally. If the AI is only good at predicting Success, its Macro F1-Score will plummet.

---

## 3. Model 2: The Task Effort Estimator
**Technical Name:** XGBoost Regressor
**Job:** To look at a task and guess a number representing how hard it is (Story Points, usually between 1 and 13).

### How it works (In Layman's Terms)
Think of a real estate appraiser. They can guess the price of a house by looking at the square footage, number of rooms, and the neighborhood.
Our AI looks at a developer's task. Since it can't "read" English like a human, we give it measurements:
* How long is the title?
* How massive is the description box? (Is it a paragraph or a giant 5-page list of instructions?)
* Is the task a "Bug" or a "Major Feature"?

It compares those measurements to 100,000 past tasks from real enterprise projects to guess a number.

### How We Evaluate It (The Metric/Matrix)
**Metric Used:** `Mean Absolute Error (MAE)`

**What is Mean Absolute Error?**
Because this AI is guessing a specific number (like "5 points" or "8 points") instead of a category ("Success" or "Failure"), we use MAE. 
MAE simply tells us: **"On average, how many points off is our AI's guess?"**

* *Example:* If the real task took 8 points of effort, and our AI guessed 5 points, the error is 3. 
* If we test the AI on 1,000 tasks and average all its mistakes, we get the MAE. A lower MAE means our AI is extremely accurate at guessing how much work a developer needs to do.

---

## 4. The "Secret Sauce" (Advanced Techniques Explained Simply)
How did we make our AI so smart? We used two special algorithms behind the scenes:

### 1. SMOTE (Handling Imbalanced Data)
**The Problem:** In our historical data, there are way more successful sprints than failed sprints. The AI didn't have enough "bad examples" to study.
**The Layman Solution:** `SMOTE` is like a flight simulator for the AI. It takes the few "failed sprints" we DO have, mathematically studies their patterns, and generates *synthetic* (fake but realistic) failed sprints. Now the AI has an equal 50/50 split of successes and failures to study!

### 2. Optuna (Hyperparameter Tuning)
**The Problem:** Building an AI is like tuning a radio with hundreds of dials (learning rate, tree depth, etc.). Guessing the right dial positions to get a clear signal takes humans weeks.
**The Layman Solution:** `Optuna` is a robot that turns the dials for us. It runs 100 different automated experiments (trials). Each time it fails, it learns *why* it failed, turns the dials in a smarter direction, and tries again until it finds the absolute perfect settings for our XGBoost models.