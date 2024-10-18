# Photo Tagging App

## Website Link

- [**Touhou Ensemble**](https://taupe-medovik-26ae2d.netlify.app/)

## Key Features

- **Frontend Responsive Design**
- **Backend Game Handling**

## Technologies Used

- **Backend:**
  - Node.js
  - Express.js
  - Prisma (ORM)
  - PostgreSQL (Database)
  - JWT (Authentication)
  - Railway (Deployment)
- **Frontend:**
  - React (Frameworks)
  - Netlify (Deployment)

## Debugging Notes

**React useEffect() Double Execution Error Handling in Dev Mode:**

- Use useRef() and the following code setup

```js
const mountRequested = useRef(false);
useEffect(() => {
  // ...functions that must run once only
  if (!mountRequested.current) {
    mountRequest();
    mountRequested.current = true;
  }
}, []);
```
