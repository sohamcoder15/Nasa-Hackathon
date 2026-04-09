# app.py (Updated with Air Quality & Advice)

from flask import Flask, render_template, request, jsonify
import requests
import os
import random
import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")

NASA_API_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
OPENWEATHER_GEO_URL = "http://api.openweathermap.org/geo/1.0/direct"
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

# NEW: Helper function to interpret Aerosol Optical Depth (AOD)
def interpret_aod(aod_value):
    """Converts a numerical AOD value into a user-friendly category."""
    if aod_value < 0.2:
        return "Good"
    elif 0.2 <= aod_value < 0.4:
        return "Moderate"
    else:
        return "Poor"

# NEW: Helper function to generate advice based on weather data
def generate_advice(avg_rain, air_quality_category):
    """Creates a list of advice strings based on the forecast."""
    advice_list = []
    if avg_rain > 10.0:
        advice_list.append("Heavy rainfall is possible. Be prepared and consider staying indoors.")
    elif avg_rain > 1.0:
        advice_list.append("Light showers expected. It's a good idea to carry an umbrella.")

    if air_quality_category == "Poor":
        advice_list.append("Poor air quality detected. It's recommended to limit strenuous outdoor activities.")
    elif air_quality_category == "Moderate":
        advice_list.append("Air quality is moderate. Sensitive individuals should consider limiting time outdoors.")

    if not advice_list:
        advice_list.append("Weather looks great for your event! Enjoy your parade.")
        
    return advice_list

def generate_fake_forecast(city):
    """Simulates a 6-month forecast using random weather patterns for demo purposes."""
    today = datetime.date.today()
    forecast = []
    for i in range(180):
        day = today + datetime.timedelta(days=i)
        forecast.append({
            "date": day.strftime("%Y-%m-%d"),
            "temp": round(random.uniform(15, 32), 1),
            "rain": round(random.uniform(0, 8), 1),
            "wind": round(random.uniform(1, 7), 1)
        })
    return forecast

@app.route("/")
def index():
    """Serves the main HTML page."""
    return render_template("index.html")

@app.route("/get_forecast", methods=["POST"])
def get_forecast():
    try:
        if not OPENWEATHER_API_KEY:
            raise ValueError("OpenWeatherMap API key not found.")

        payload = request.get_json() or {}
        city = payload.get("city", "").strip()
        selected_date = payload.get("date", "").strip()

        if not city:
            return jsonify({"status": "error", "message": "City name is required"}), 400

        geo_params = {"q": city, "limit": 1, "appid": OPENWEATHER_API_KEY}
        geo_res = requests.get(OPENWEATHER_GEO_URL, params=geo_params, timeout=10)
        geo_res.raise_for_status()
        location_data = geo_res.json()

        if not location_data:
            return jsonify({"status": "error", "message": f"Could not find coordinates for: {city}"}), 404

        lat, lon = location_data[0]["lat"], location_data[0]["lon"]
        found_city_name = location_data[0]["name"]
        
        # MODIFIED: Added AOD_550 to the parameters list to get air quality data
        nasa_params = {
            "parameters": "T2M,PRECTOTCORR,WS2M,AOD_550",
            "start": "20150101",
            "end": "20241231",
            "latitude": lat,
            "longitude": lon,
            "community": "RE",
            "format": "JSON"
        }
        
        avg_temp, avg_rain, avg_wind, avg_aod = 28, 5, 3, 0.1 # Default values
        try:
            nasa_res = requests.get(NASA_API_URL, params=nasa_params, timeout=20)
            nasa_res.raise_for_status()
            nasa_data = nasa_res.json()
            
            params_data = nasa_data.get("properties", {}).get("parameter", {})
            temps = params_data.get("T2M", {})
            rains = params_data.get("PRECTOTCORR", {})
            winds = params_data.get("WS2M", {})
            aods = params_data.get("AOD_550", {}) # NEW: Get AOD data

            valid_temps = [v for v in temps.values() if v != -999]
            valid_rains = [v for v in rains.values() if v != -999]
            valid_winds = [v for v in winds.values() if v != -999]
            valid_aods = [v for v in aods.values() if v != -999] # NEW: Validate AOD data
            
            if valid_temps: avg_temp = sum(valid_temps) / len(valid_temps)
            if valid_rains: avg_rain = sum(valid_rains) / len(valid_rains)
            if valid_winds: avg_wind = sum(valid_winds) / len(valid_winds)
            if valid_aods: avg_aod = sum(valid_aods) / len(valid_aods) # NEW: Calculate average AOD

        except requests.exceptions.RequestException as e:
            print(f"Warning: NASA POWER API call failed: {e}. Using fallback averages.")

        # NEW: Interpret data and generate advice
        air_quality_category = interpret_aod(avg_aod)
        advice_list = generate_advice(avg_rain, air_quality_category)

        forecast = generate_fake_forecast(city)
        day_forecast = next((f for f in forecast if f["date"] == selected_date), None)

        # MODIFIED: Added new data to the JSON response
        return jsonify({
            "status": "success",
            "city": found_city_name,
            "avg_temp": round(avg_temp, 2),
            "avg_rain": round(avg_rain, 2),
            "avg_wind": round(avg_wind, 2),
            "air_quality": air_quality_category, # NEW
            "advice": advice_list, # NEW
            "forecast": forecast,
            "day_forecast": day_forecast
        })

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"status": "error", "message": f"An internal server error occurred: {e}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)