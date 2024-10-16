import { useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../App";
import { Link } from "react-router-dom";

function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);

  async function getLeaderboard() {
    try {
      const response = await axios.get(`${apiUrl}/leaderboard`, {
        withCredentials: true,
      });
      setLeaderboard(response.data);
    } catch (error) {
      console.error("Leaderboard get failed:", error);
    }
  }

  useEffect(() => {
    getLeaderboard();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-end mb-8">
        <Link
          to="/"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Create Your Score
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-center mb-8">Leaderboard</h1>

      {leaderboard.length ? (
        <table className="table-auto w-full bg-white shadow-md rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-200 text-gray-700 uppercase text-left">
              <th className="py-3 px-6 font-semibold">Rank</th>
              <th className="py-3 px-6 font-semibold">Name</th>
              <th className="py-3 px-6 font-semibold">Time (second)</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <tr
                key={entry.id}
                className={index % 2 === 0 ? "bg-gray-100" : ""}
              >
                <td className="py-3 px-6 text-center">{index + 1}</td>
                <td className="py-3 px-6">{entry.name}</td>
                <td className="py-3 px-6 text-center">{entry.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <h1 className="text-2xl text-center text-gray-600">
          Leaderboard is Currently Empty...
        </h1>
      )}
    </div>
  );
}

export default LeaderboardPage;
