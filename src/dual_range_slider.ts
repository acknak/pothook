const rangeColor = `oklch(${getComputedStyle(document.querySelector(":root")!).getPropertyValue("--p")})`;
const sliderColor = `oklch(${getComputedStyle(document.querySelector(":root")!).getPropertyValue("--b3")})`;

export function controlFromSlider(fromSlider: HTMLInputElement, toSlider: HTMLInputElement, fromInput: HTMLInputElement) {
  const [from, to] = getParsed(fromSlider, toSlider);
  fillSlider(fromSlider, toSlider, toSlider);
  if (from > to) {
    fromSlider.value = to.toString();
    fromInput.value = getTime(to);
  } else {
    fromInput.value = getTime(from);
  }
}

export function controlToSlider(fromSlider: HTMLInputElement, toSlider: HTMLInputElement, toInput: HTMLInputElement) {
  const [from, to] = getParsed(fromSlider, toSlider);
  fillSlider(fromSlider, toSlider, toSlider);
  setToggleAccessible(toSlider);
  if (from <= to) {
    toSlider.value = to.toString();
    toInput.value = getTime(to);
  } else {
    toInput.value = getTime(from);
    toSlider.value = from.toString();
  }
}

export function getParsed(
  currentFrom: HTMLInputElement = document.querySelector("#fromSlider") as HTMLInputElement,
  currentTo: HTMLInputElement = document.querySelector("#toSlider") as HTMLInputElement
) {
  const from = parseInt(currentFrom.value, 10);
  const to = parseInt(currentTo.value, 10);
  return [from, to];
}

export function getTime(ratio: number): string {
  const sec = (document.querySelector("#voice-audio") as HTMLAudioElement).duration * (ratio / 1000);
  return (
    Math.trunc(sec / 3600)
      .toString()
      .padStart(2, "0") +
    ":" +
    Math.trunc((sec / 60) % 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    Math.trunc(sec % 60)
      .toString()
      .padStart(2, "0")
  );
}

export function fillSlider(from: HTMLInputElement, to: HTMLInputElement, controlSlider: HTMLInputElement) {
  const rangeDistance = parseInt(to.max) - parseInt(to.min);
  const fromPosition = parseInt(from.value) - parseInt(to.min);
  const toPosition = parseInt(to.value) - parseInt(to.min);
  controlSlider.style.background = `linear-gradient(
      to right,
      ${sliderColor} 0%,
      ${sliderColor} ${(fromPosition / rangeDistance) * 100}%,
      ${rangeColor} ${(fromPosition / rangeDistance) * 100}%,
      ${rangeColor} ${(toPosition / rangeDistance) * 100}%, 
      ${sliderColor} ${(toPosition / rangeDistance) * 100}%, 
      ${sliderColor} 100%)`;
}

export function setToggleAccessible(currentTarget: HTMLInputElement) {
  const toSlider = document.querySelector("#toSlider") as HTMLInputElement;
  if (Number(currentTarget.value && toSlider) <= 0) {
    toSlider.style.zIndex = "2";
  } else {
    toSlider.style.zIndex = "0";
  }
}
