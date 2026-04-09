// // Basic interactions: form navigation + intersection observer for reveal animations

// // Form submit: navigate to /weather?city=...&date=...
// document.addEventListener('DOMContentLoaded', function () {
//   const form = document.getElementById('forecast-form');
//   if (form) {
//     form.addEventListener('submit', function (e) {
//       e.preventDefault();
//       const city = encodeURIComponent(document.getElementById('city').value.trim());
//       const date = encodeURIComponent(document.getElementById('date').value);
//       if (!city || !date) {
//         alert('Please enter both city and date.');
//         return;
//       }
//       // Simulate navigation — in real app you'd route to a page or fetch API
//       // For local hackathon demo, we'll redirect to a simple query page route:
//       window.location.href = `/weather?city=${city}&date=${date}`;
//     });
//   }

//   // IntersectionObserver reveal for sections and steps
//   const revealNodes = document.querySelectorAll('.step, .nasa-image-wrap, .plan-card, .about-wrap, .hero-right, .section-title, .kicker');
//   const obs = new IntersectionObserver((entries, observer) => {
//     entries.forEach(entry => {
//       if (entry.isIntersecting) {
//         entry.target.classList.add('inview');
//         observer.unobserve(entry.target);
//       }
//     });
//   }, { threshold: 0.12 });

//   revealNodes.forEach(n => obs.observe(n));
// });
// static/script.js

// Global variable to hold the chart instance, so we can destroy it before creating a new one
let chartInstance = null;

// This function handles the API call and updates the UI
async function fetchForecast() {
  const city = document.getElementById("city").value.trim();
  const date = document.getElementById("date").value;

  if (!city || !date) {
    alert("Please enter both a city and a date.");
    return;
  }

  const button = document.getElementById('check-btn');
  const resultsSection = document.getElementById('results-section');

  try {
    // Show a loading state on the button
    button.textContent = "Fetching...";
    button.disabled = true;

    // Call our own Flask backend API
    const response = await fetch("/get_forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, date }),
    });

    const data = await response.json();

    // Reset button state
    button.textContent = "Check Forecast";
    button.disabled = false;

    if (data.status !== "success") {
      alert(data.message || "❌ Unable to fetch forecast data.");
      return;
    }

    // --- Populate the UI with the received data ---

    resultsSection.classList.remove("hidden");
    // Add this line with the other card population logic
document.getElementById("airQualityValue").textContent = data.air_quality;

// Add this block to populate the advice list
const adviceContainer = document.getElementById('advice-section');
const adviceList = document.getElementById('adviceList');
adviceList.innerHTML = ''; // Clear any old advice

if (data.advice && data.advice.length > 0) {
  data.advice.forEach(tip => {
    const li = document.createElement('li');
    li.textContent = tip;
    adviceList.appendChild(li);
  });
  adviceContainer.classList.remove('hidden');
} else {
  adviceContainer.classList.add('hidden');
}


    document.getElementById("cityName").textContent = `Forecast for ${data.city}`;
    
    // Populate average stat cards
    document.getElementById("avgTemp").textContent = data.avg_temp;
    document.getElementById("avgRain").textContent = data.avg_rain;
    document.getElementById("avgWind").textContent = data.avg_wind;

    // Populate the specific day forecast card
    const dayBox = document.getElementById("specificDay");
    if (data.day_forecast) {
      dayBox.classList.remove("hidden");
      dayBox.innerHTML = `
        <div class="icon">📅</div>
        <div>
          <strong>Forecast for ${data.day_forecast.date}</strong><br>
          <span>🌡 Temp: ${data.day_forecast.temp}°C | 🌧 Rain: ${data.day_forecast.rain}mm | 🌬 Wind: ${data.day_forecast.wind} m/s</span>
        </div>
      `;
    } else {
      dayBox.classList.add("hidden");
    }

    // --- Render the Chart ---
    if (Array.isArray(data.forecast)) {
      const labels = data.forecast.map(f => f.date);
      const temps = data.forecast.map(f => f.temp);
      const rains = data.forecast.map(f => f.rain);
      const winds = data.forecast.map(f => f.wind);

      const ctx = document.getElementById("forecastChart").getContext("2d");
      if (chartInstance) {
        chartInstance.destroy(); // Destroy old chart before creating new one
      }

      chartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Temperature (°C)",
              data: temps,
              borderColor: "#ff9f1c", // Use theme color
              backgroundColor: "rgba(255, 159, 28, 0.2)",
              fill: true,
              tension: 0.4,
            },
            {
              label: "Rainfall (mm)",
              data: rains,
              borderColor: "#9b5de5", // Use theme color
              backgroundColor: "rgba(155, 93, 229, 0.2)",
              fill: true,
              tension: 0.4,
            },
            {
              label: "Wind Speed (m/s)",
              data: winds,
              borderColor: "#4BC0C0",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: "6-Month Climate Forecast",
              font: { size: 20, family: 'Poppins, sans-serif' },
            },
            legend: { position: "top" },
          },
          scales: {
            x: { title: { display: true, text: "Date" } },
            y: { title: { display: true, text: "Value" } },
          },
        },
      });

      document.querySelector(".chart-container").classList.remove("hidden");
    }
    
    // --- Render the Data Table ---
    let tableHTML = `
      <h4 class="section-title">Forecast Data (Next 15 Days)</h4>
      <table>
        <thead>
          <tr><th>Date</th><th>Temp (°C)</th><th>Rain (mm)</th><th>Wind (m/s)</th></tr>
        </thead>
        <tbody>
    `;
    data.forecast.slice(0, 15).forEach(f => {
      tableHTML += `<tr><td>${f.date}</td><td>${f.temp}</td><td>${f.rain}</td><td>${f.wind}</td></tr>`;
    });
    tableHTML += "</tbody></table>";
    
    const forecastTable = document.getElementById("forecastTable");
    forecastTable.innerHTML = tableHTML;
    forecastTable.classList.remove("hidden");

    // Scroll smoothly to the results
    resultsSection.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error("Error fetching forecast:", err);
    alert("⚠️ Something went wrong. Please check the console for errors.");
    // Reset button state on error
    button.textContent = "Check Forecast";
    button.disabled = false;
  }
}


// --- Event Listeners from Original Hackathon Theme ---
document.addEventListener('DOMContentLoaded', function () {
  
  // Attach our new function to the form submission
  const form = document.getElementById('forecast-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault(); // Prevent page reload
      fetchForecast();      // Call our API function
    });
  }

  // IntersectionObserver for reveal animations (from original theme)
  const revealNodes = document.querySelectorAll('.step, .nasa-image-wrap, .plan-card, .about-wrap, .hero-right, .section-title, .kicker');
  const obs = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('inview');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealNodes.forEach(n => obs.observe(n));
});
