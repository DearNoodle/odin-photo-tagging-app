import React, { useEffect } from "react";
import axios from "axios";
import { apiUrl } from "../App";
import { useNavigate } from "react-router-dom";

function Clickdropdown({
  coord,
  rect,
  ringSize,
  flip,
  setShowDropdown,
  unfoundCharacters,
  setUnfoundCharacters,
  setRingColor,
  showModal,
  setShowModal,
}) {
  const navigate = useNavigate();

  const { normalX, normalY } = coord;
  const x = normalX * rect.width;
  const y = normalY * rect.height;

  function toggleModal() {
    setShowModal(!showModal);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const formData = new FormData(event.target);
    const character = formData.get("character");

    try {
      const response = await axios.put(
        `${apiUrl}/click`,
        {
          normalX,
          normalY,
          character,
        },
        { withCredentials: true }
      );

      if (response.data === "Correct Click") {
        setUnfoundCharacters(
          unfoundCharacters.filter((char) => char !== character)
        );
        setRingColor("green");
      } else {
        setRingColor("red");
      }

      setShowDropdown(false);

      if (!unfoundCharacters[1]) {
        setTimeout(function () {
          toggleModal();
        }, 1000);
      }
    } catch (error) {
      console.error("Click Submit failed:", error);
    }
  }

  return (
    <div
      className="click-dropdown text-[11px]"
      key={`${x}${y}`}
      style={
        flip
          ? {
              left: `${x - ringSize / 1.5 - 112}px`,
              top: `${y - ringSize / 1.5}px`,
            }
          : {
              left: `${x + ringSize / 1.5}px`,
              top: `${y - ringSize / 1.5}px`,
            }
      }
      onClick={(event) => event.stopPropagation()}
    >
      <ul className="flex flex-col gap-2">
        {unfoundCharacters.map((character) => (
          <li key={character}>
            <form onSubmit={handleSubmit}>
              <input
                className="hidden"
                type="text"
                name="character"
                defaultValue={character}
              />
              <button className="w-24" type="submit">
                {character}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Clickdropdown;
