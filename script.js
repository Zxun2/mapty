'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const controlsContainer = document.querySelector('.controls');
const msg = document.querySelector('.confirmation__msg');
const yesButton = document.querySelector('.yes__button');
const noButton = document.querySelector('.no__button');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10); //Convert to string before slicing
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; //[lat,lng]
    this.distance = distance; //km
    this.duration = duration; //min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 
    'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    //min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    //km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapEvent;
  #mapZoomLevel = 13;
  #workouts = [];
  #markers = [];

  constructor() {
    // Gets user's position
    this._getPosition();

    // Gets data from local storage
    this._getLocalStorage();

    // Attach Event handler
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener(
      'click',
      this._deleteOrMoveToPopup.bind(this)
    );
    controlsContainer.addEventListener(
      'click',
      this._controlsFunctionality.bind(this)
    );
    noButton.addEventListener('click', () => {
      msg.classList.add('hide');
    });
    yesButton.addEventListener('click', this.reset);
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];
    console.log(coords);

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    L.marker(coords).addTo(this.#map).bindPopup('Your Location!').openPopup();

    // Handling Clicks on the Map
    this.#map.on('click', this._showForm.bind(this));

    // Render workout marker
    this.#workouts.forEach(work => this._renderWorkoutMarker(work));
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm(workout) {
    inputDuration.value =
      inputCadence.value =
      inputDistance.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const positiveNums = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get Data from input fields
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;

    let workout;

    // If workout running, create running object
    if (type === 'running') {
      // Check if data is valid
      const cadence = +inputCadence.value;
      if (
        !validInputs(duration, distance, cadence) ||
        !positiveNums(distance, duration, cadence)
      )
        return alert('Inputs should be a positive number!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if inputs are valid
      if (
        !validInputs(distance, duration, elevation) ||
        !positiveNums(distance, duration, elevation)
      ) {
        return alert('Inputs should be a positive number!');
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object into the workout array
    this.#workouts.push(workout);

    // Render workout on the map as a marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide forms and clear inputs fields
    this._hideForm(workout);

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const layer = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(layer);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <h2 class="workout__title">${workout.description}</h2>
            <div class="workout__details">
              <span class="workout__icon">${
                workout.type === 'running' ? '🏃' : '🚴‍♀️'
              } </span>
              <span class="workout__value">${workout.distance}</span>
              <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
              <span class="workout__icon">⏱</span>
              <span class="workout__value">${workout.duration}</span>
              <span class="workout__unit">min</span>
            </div>
    `;

    if (workout.type === 'running') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
          <button class="remove_btn">x</button>
        </li>
      `;
    }

    if (workout.type === 'cycling') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
          <button class="remove_btn">x</button>
        </li>
      `;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _getId(e) {
    // detect workout element on click
    const element = e.target.closest('.workout');
    if (element) {
      // get info about the workout that was clicked on
      const id = element.dataset.id;
      const foundWorkout = this.#workouts.find(elem => elem.id === id);
      const workoutIndex = this.#workouts.indexOf(foundWorkout);
      return [id, foundWorkout, workoutIndex, element];
    }
    return [];
  }

  _removeWorkout(element, workoutIndex) {
    // 1. remove from list
    element.remove();

    // 2. remove from array
    this.#workouts.splice(workoutIndex, 1);

    // 3. remove from map
    this.#markers[workoutIndex].remove();

    // 4. remove from marker array
    this.#markers.splice(workoutIndex, 1);
  }

  _deleteOrMoveToPopup(e) {
    const [id, foundWorkout, workoutIndex, element] = this._getId(e);
    console.log(id, foundWorkout, workoutIndex, element);
    console.log(e.target);
    // if no info, return
    if (!id) return;

    // 2. if remove__btn is clicked then remove item
    if (e.target.classList.contains('remove_btn')) {
      this._removeWorkout(element, workoutIndex);
      // 4. update local storage
      this._setLocalStorage();
      return;
    }

    this.#map.setView(foundWorkout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _controlsFunctionality(e) {
    if (e.target.classList.contains('clear-all')) {
      msg.classList.remove('hide');
    }

    if (e.target.classList.contains('overview')) {
      // if there are no workouts return
      if (this.#workouts.length === 0) return;

      // find lowest and highest lat and long to make map bounds that fit all markers
      const latitudes = this.#workouts.map(w => {
        return w.coords[0];
      });
      const longitudes = this.#workouts.map(w => {
        return w.coords[1];
      });
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLong = Math.min(...longitudes);
      const maxLong = Math.max(...longitudes);
      // fit bounds with coordinates
      this.#map.fitBounds(
        [
          [maxLat, minLong],
          [minLat, maxLong],
        ],
        { padding: [70, 70] }
      );
    }
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    console.log(data);

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => this._renderWorkout(work));
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
