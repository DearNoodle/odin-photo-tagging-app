import React, { useState, useEffect, useContext, useRef } from "react";
import ClickRing from "../components/ClickRing";
import Clickdropdown from "../components/Clickdropdown";
import { apiUrl } from "../App";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

function MainPage() {
  const navigate = useNavigate();
  const mountRequested = useRef(false);
  const imageContainerRef = useRef(null);
  const [clickPosition, setClickPosition] = useState(null);
  const [ringColor, setRingColor] = useState("white");
  const [ringSize, setRingSize] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [flipDropDown, setFlipDropDown] = useState(false);
  const [containerRect, setContainerRect] = useState(null);
  const [unfoundCharacters, setUnfoundCharacters] = useState([
    "Hinanawi Tenshi",
    "Reiuji Utsuho",
    "Mystia Lorelei",
    "Flandre Scarlet",
    "Shiki Eiki",
  ]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [timer, setTimer] = useState(0);

  function handleCircleClick(event) {
    setRingColor("white");

    setContainerRect(imageContainerRef.current.getBoundingClientRect());
    const x = event.clientX - containerRect.left;
    const y = event.clientY - containerRect.top;

    if (
      x < ringSize / 2 ||
      containerRect.width - x < ringSize / 2 ||
      y < ringSize / 2 ||
      containerRect.height - y < ringSize / 2
    ) {
      return; // Cancel if click is too close to the border
    }

    const newRingSize = imageContainerRef.current.offsetHeight * 0.2;
    if (newRingSize !== ringSize) {
      setRingSize(newRingSize);
    }

    if (x > containerRect.width / 2) {
      setFlipDropDown(true);
    } else {
      setFlipDropDown(false);
    }
    const normalX = x / containerRect.width;
    const normalY = y / containerRect.height;
    setClickPosition({ normalX, normalY });
    setShowDropdown(true);
  }

  async function handleNameSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const response = await axios.post(
      `${apiUrl}/leaderboard`,
      {
        name,
      },
      { withCredentials: true }
    );
    navigate("/leaderboard");
  }

  async function handleCancelModal(event) {
    event.preventDefault();
    event.stopPropagation();
    navigate("/leaderboard");
  }

  async function getToken() {
    try {
      await axios.get(`${apiUrl}/token`, { withCredentials: true });
    } catch (error) {
      console.error("Token get failed:", error);
    }
  }

  async function createSession() {
    try {
      const response = await axios.post(`${apiUrl}/session`, null, {
        withCredentials: true,
      });
      console.log(response.data);
    } catch (error) {
      console.error("Session create failed:", error);
    }
  }

  useEffect(() => {
    async function mountRequest() {
      await getToken();
      await createSession();
    }
    if (!mountRequested.current) {
      mountRequest();
      mountRequested.current = true;
    }
  }, []);

  useEffect(() => {
    function handleResize() {
      setRingSize(imageContainerRef.current.offsetHeight * 0.2);
      setContainerRect(imageContainerRef.current.getBoundingClientRect());
    }

    setContainerRect(imageContainerRef.current.getBoundingClientRect());
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let intervalId;
    if (!showModal) {
      // Only run the timer if the modal is not showing
      intervalId = setInterval(() => {
        setTimer((prevTimer) => prevTimer + 1);
      }, 1000);
    }

    return () => clearInterval(intervalId);
  }, [showModal]); // Update timer every second and clear on unmount or when showModal changes

  return (
    <div className="text-center flex flex-col gap-4 items-center font-mono">
      {showModal && (
        <div>
          <div className="fixed inset-0 backdrop-blur-sm bg-black/30 z-40"></div>

          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg relative">
              <h1 className="text-2xl font-bold mb-4">Finished</h1>
              <h1 className="text-xl mb-6">Enter Your Name</h1>
              <form
                className="flex flex-col items-center"
                onSubmit={handleNameSubmit}
              >
                <input
                  type="text"
                  className="text-2xl font-bold mb-6 text-center p-2 border border-gray-400 rounded-md"
                  placeholder="Type Here"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="flex gap-4">
                  <button type="submit">Confirm</button>
                  <button onClick={handleCancelModal}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <div className="flex w-[80%] justify-between">
        <div className="text-2xl">Timer:{timer}</div>
        <div className="">
          <Link
            to="/leaderboard"
            className="text-2xl underline text-blue-400 hover:text-blue-300"
          >
            LeaderBoard
          </Link>
        </div>
      </div>
      <div className="px-2 py-4 flex justify-center items-center">
        <ul className="w-2/3 flex gap-3 justify-center">
          {[
            { img: "/img/tenshi.jpg", name: "Hinanawi Tenshi" },
            { img: "/img/okuu.jpg", name: "Reiuji Utsuho" },
            { img: "/img/mystia.jpg", name: "Mystia Lorelei" },
            { img: "/img/flandre.jpg", name: "Flandre Scarlet" },
            { img: "/img/eiki.jpg", name: "Shiki Eiki" },
          ].map(({ img, name }) => (
            <li key={name} className="flex flex-col items-center">
              <img
                src={img}
                alt={name}
                className="shadow-md rounded-3xl border-[3px] border-gray-800 bg-gray-200"
              />
              <p className="text-lg">{name}</p>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="main-image-container relative cursor-pointer"
        ref={imageContainerRef}
        onClick={handleCircleClick}
      >
        <img
          className="main-image rounded-3xl border-8 border-gray-700 w-full"
          src="/img/touhou_full.jpg"
          alt="Main"
        />

        {clickPosition && (
          <ClickRing
            coord={clickPosition}
            rect={containerRect}
            size={ringSize}
            color={ringColor}
          />
        )}

        {showDropdown && unfoundCharacters[0] && (
          <Clickdropdown
            coord={clickPosition}
            rect={containerRect}
            ringSize={ringSize}
            flip={flipDropDown}
            setShowDropdown={setShowDropdown}
            unfoundCharacters={unfoundCharacters}
            setUnfoundCharacters={setUnfoundCharacters}
            setRingColor={setRingColor}
            showModal={showModal}
            setShowModal={setShowModal}
          />
        )}
      </div>
    </div>
  );
}

export default MainPage;
