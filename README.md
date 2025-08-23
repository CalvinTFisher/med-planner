**MedPlanner**
MedPlanner is a demo full stack web application that is designed to help simplify medication management for users and caregivers. 
This project started as an idea from my grampa when he was sick, he was taking upwards of 20-30 different pills a day full of medication and vitamins. Some were making him sicker, he didn't know when to take what or with what and this is the problem this application will aim to solve.
Currently this project uses some api calls as well as demo logic to stimulate a process for a user to simply input the medication they take everyday and have a well thought out and structured plan for how to take it.

Starting with the front-end, this is an overall view of the interface and UI the user is currently greeted with:
<img width="1470" height="831" alt="image" src="https://github.com/user-attachments/assets/3e9db815-d5c8-472b-bb13-6d44b0f42395" />
Medication adder UI as well as patient info and option to generate plan. Users are able to add medications, vitamins, and patient info here.
<img width="1273" height="750" alt="image" src="https://github.com/user-attachments/assets/0f1714f3-57a0-419a-8201-014037709bab" />
**Plan Generation**
This will be the main goal of this application. Here is where a user can take the info they entered as well as the drugs and generate a plan of when to take the drugs, what to take it with, etc.
Here is an example of the plan generation with 2 medicines, neoproxin and ibuprofen.
<img width="1258" height="380" alt="image" src="https://github.com/user-attachments/assets/7435ed29-6d9f-4df3-b6fe-de3329596412" />
This plan shows demo logic but is legitametely hooked up to a backend used locally through uvicorn. When the user clicks generate plan, it uses RxNorm to get id and DailyMed to find info like whether to take with food, time of day, as well as what to avoid it with.
<img width="1275" height="491" alt="image" src="https://github.com/user-attachments/assets/fa277ef3-51c5-4130-81cf-df6ed9fe8c93" />
This now shows the interaction menu with drugs. As of now this pulls from a hardcoded list of known interactions because access to a public free interactions api is limited at this time.
<img width="1266" height="407" alt="image" src="https://github.com/user-attachments/assets/8ebe5031-b7b6-49e5-af44-db47e62a52d0" />
These are resources and planned resources for future deployments.

