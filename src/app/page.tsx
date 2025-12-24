"use client";

import React, { useState, useEffect } from "react";
import { Plane, Clock, MapPin, Gauge, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";

// Load map component client-side only to avoid Leaflet server-side errors
const WorldMapClient = dynamic(() => import("../components/WorldMapClient"), {
  ssr: false,
});

interface FlightData {
  currentLat: number | null;
  currentLon: number | null;
  altitude: number;
  speed: number;
  progress: number;
  currentRegion: string;
  isLive: boolean;
  callsign?: string;
  onGround?: boolean;
}

const LeaderHomecoming = () => {
  const [flightData, setFlightData] = useState<FlightData>({
    currentLat: null,
    currentLon: null,
    altitude: 0,
    speed: 0,
    progress: 0,
    currentRegion: "Searching...",
    isLive: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const departureCity = "London Heathrow";
  const arrivalCity = "Dhaka, Bangladesh";
  const flightNumber = "Biman Bangladesh";
  const passengerName = "Tarique Rahman";

  // Coordinates
  const departure = { lat: 51.47, lon: -0.4543 };
  const arrival = { lat: 23.8103, lon: 90.4125 };

  // Waypoints for map display
  const waypoints = [
    { name: "London", lat: 51.47, lon: -0.4543, region: "United Kingdom" },
    { name: "Brussels", lat: 50.8, lon: 4.3, region: "Belgium" },
    { name: "Munich", lat: 48.1, lon: 11.6, region: "Germany" },
    { name: "Vienna", lat: 48.2, lon: 16.4, region: "Austria" },
    { name: "Istanbul", lat: 41.0, lon: 29.0, region: "Turkey" },
    { name: "Ankara", lat: 39.9, lon: 32.8, region: "Turkey" },
    { name: "Tehran", lat: 35.7, lon: 51.4, region: "Iran" },
    { name: "Mashhad", lat: 36.3, lon: 59.6, region: "Iran" },
    { name: "Kabul", lat: 34.5, lon: 69.2, region: "Afghanistan" },
    { name: "Islamabad", lat: 33.7, lon: 73.1, region: "Pakistan" },
    { name: "Lahore", lat: 31.5, lon: 74.3, region: "Pakistan" },
    { name: "Delhi", lat: 28.6, lon: 77.2, region: "India" },
    { name: "Kolkata", lat: 22.6, lon: 88.4, region: "India" },
    { name: "Dhaka", lat: 23.8103, lon: 90.4125, region: "Bangladesh" },
  ];

  // Determine current region based on coordinates
  const getCurrentRegion = (lat: number, lon: number): string => {
    if (!lat || !lon) return "Unknown";

    // Simple region detection based on lat/lon ranges
    if (lon < 10) return "Western Europe";
    if (lon < 30) return "Eastern Europe";
    if (lon < 45) return "Turkey/Middle East";
    if (lon < 60) return "Iran";
    if (lon < 70) return "Central Asia";
    if (lon < 80) return "Pakistan";
    if (lon < 88) return "India";
    return "Bangladesh";
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fetch real flight data from OpenSky Network
  const fetchFlightData = async () => {
    try {
      // OpenSky Network API - free, no key needed
      // Expanded search area to cover entire London to Dhaka route
      const lamin = 20; // Bangladesh/South Asia
      const lomin = -5; // West of London
      const lamax = 55; // North of route
      const lomax = 95; // East Bangladesh

      const response = await fetch(
        `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch flight data");
      }

      const data = await response.json();

      if (!data.states || data.states.length === 0) {
        setError(
          "No Biman Bangladesh flights currently tracked - BG202 may not be in the air"
        );
        setLoading(false);
        return;
      }

      // HARDCODED: Look ONLY for Biman Bangladesh flight BG202
      // OpenSky data format: [icao24, callsign, origin_country, time_position, last_contact,
      //                       longitude, latitude, baro_altitude, on_ground, velocity, ...]

      let targetFlight = null;

      // Search specifically for BG202 or any Biman Bangladesh international flight (BBC callsign)
      for (const state of data.states) {
        const callsign = state[1] ? state[1].trim() : "";
        const lon = state[5];
        const lat = state[6];
        const altitude = state[7]; // meters
        const velocity = state[9]; // m/s
        const onGround = state[8];

        // Look for BG202 specifically, or any Biman Bangladesh flight (BBC prefix)
        // that's at cruise altitude (indicating international flight, not domestic)
        if (!onGround && lat && lon && altitude > 6000) {
          // > 20,000 feet indicates international
          if (callsign.includes("BG202") || callsign.includes("BBC202")) {
            targetFlight = state;
            break;
          }
          // Fallback: Any Biman Bangladesh international flight
          if (callsign.startsWith("BBC") && !targetFlight) {
            targetFlight = state;
          }
        }
      }

      // If no match found
      if (!targetFlight) {
        setError(
          "BG202 not currently in flight - Flight may be scheduled later"
        );
        setLoading(false);
        return;
      }

      if (targetFlight) {
        const [
          icao24,
          callsign,
          originCountry,
          timePosition,
          lastContact,
          lon,
          lat,
          baroAltitude,
          onGround,
          velocity,
        ] = targetFlight;

        if (lat && lon) {
          const altitudeFeet = baroAltitude
            ? Math.round(baroAltitude * 3.28084)
            : 0;
          const speedMph = velocity ? Math.round(velocity * 2.23694) : 0;

          // Calculate progress (distance from departure to current / total distance)
          const totalDistance = calculateDistance(
            departure.lat,
            departure.lon,
            arrival.lat,
            arrival.lon
          );
          const distanceFromDeparture = calculateDistance(
            departure.lat,
            departure.lon,
            lat,
            lon
          );
          const progress = Math.min(distanceFromDeparture / totalDistance, 1);

          setFlightData({
            currentLat: lat,
            currentLon: lon,
            altitude: altitudeFeet,
            speed: speedMph,
            progress: progress,
            currentRegion: getCurrentRegion(lat, lon),
            isLive: true,
            callsign: callsign?.trim() || "Unknown",
            onGround: onGround,
          });

          setLastUpdate(new Date());
          setLoading(false);
          setError(null);
        }
      } else {
        setError("No suitable flights found in the area");
        setLoading(false);
      }
    } catch (err) {
      // Error handling in fetchFlightData
      console.error("Error fetching flight data:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unknown error occurred");
      }
      setLoading(false);
    }
  };

  // Fetch data on mount and every 30 seconds
  useEffect(() => {
    fetchFlightData();
    const interval = setInterval(fetchFlightData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Calculate ETA (simplified)
  const calculateETA = () => {
    if (!flightData.currentLat || !flightData.speed || flightData.speed === 0) {
      return { hours: 0, minutes: 0 };
    }

    const distanceToDestination = calculateDistance(
      typeof flightData.currentLat === "number" ? flightData.currentLat : 0,
      typeof flightData.currentLon === "number" ? flightData.currentLon : 0,
      arrival.lat,
      arrival.lon
    );

    const speedKmh = flightData.speed * 1.60934;
    const hoursRemaining = distanceToDestination / speedKmh;
    const hours = Math.floor(hoursRemaining);
    const minutes = Math.round((hoursRemaining - hours) * 60);

    return { hours, minutes };
  };

  const eta = calculateETA();

  // Map projection
  const mapWidth = 1000;
  const mapHeight = 500;
  const padding = 80;

  const minLon = Math.min(...waypoints.map((w) => w.lon)) - 5;
  const maxLon = Math.max(...waypoints.map((w) => w.lon)) + 5;
  const minLat = Math.min(...waypoints.map((w) => w.lat)) - 5;
  const maxLat = Math.max(...waypoints.map((w) => w.lat)) + 5;

  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;

  const projectX = (lon: number): number =>
    ((lon - minLon) / lonRange) * (mapWidth - 2 * padding) + padding;
  const projectY = (lat: number): number =>
    mapHeight -
    ((lat - minLat) / latRange) * (mapHeight - 2 * padding) -
    padding;

  const planeX = flightData.currentLon
    ? projectX(flightData.currentLon)
    : projectX(departure.lon);
  const planeY = flightData.currentLat
    ? projectY(flightData.currentLat)
    : projectY(departure.lat);

  const getPlaneAngle = () => {
    if (!flightData.currentLat || !flightData.currentLon) return 90;
    const dx = arrival.lon - flightData.currentLon;
    const dy = arrival.lat - flightData.currentLat;
    return Math.atan2(dx, dy) * (180 / Math.PI);
  };

  const pathString = waypoints
    .map((w, i) => {
      const x = projectX(w.lon);
      const y = projectY(w.lat);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="min-h-screen bg-linear-to-br from-green-900 via-green-800 to-red-900 text-white p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="text-center mb-6 relative">
          <h1 className="text-5xl font-bold mb-2 bg-linear-to-r from-green-400 to-red-400 bg-clip-text text-transparent">
            Leader Homecoming
          </h1>
          <p className="text-xl text-green-200">
            Tracking {passengerName}'s Journey Home
          </p>

          {/* Live indicator */}
          {flightData.isLive && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-green-300">
                Live Tracking Active
              </span>
            </div>
          )}
        </div>

        {/* Status Banner */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
              <p>Searching for flight data...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-3 text-yellow-300">
              <AlertCircle className="w-6 h-6" />
              <p>{error} - Using simulated data for demonstration</p>
            </div>
          ) : (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Plane className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-sm text-gray-300">Flight Callsign</p>
                  <p className="text-2xl font-bold">
                    {flightData.callsign || flightNumber}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-400" />
                <div>
                  <p className="text-sm text-gray-300">Estimated Arrival</p>
                  <p className="text-2xl font-bold">
                    {eta.hours}h {eta.minutes}m
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Gauge className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-sm text-gray-300">Progress</p>
                  <p className="text-2xl font-bold">
                    {Math.round(flightData.progress * 100)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-6">
        {/* Flight Map */}
        <div className="md:col-span-2 bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-6 h-6" />
            Live Flight Path
          </h2>

          <div
            className="w-full rounded-lg overflow-hidden"
            style={{ height: "60vh" }}
          >
            <WorldMapClient
              center={[30, 60]}
              zoom={3}
              height="100%"
              pathCoords={waypoints.map((w) => [w.lat, w.lon])}
              planePosition={
                flightData.currentLat && flightData.currentLon
                  ? [flightData.currentLat, flightData.currentLon]
                  : null
              }
            />
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-linear-to-r from-green-500 to-yellow-500 h-full transition-all duration-500"
                style={{ width: `${flightData.progress * 100}%` }}
              />
            </div>
          </div>

          {lastUpdate && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Last updated:{" "}
              {lastUpdate instanceof Date
                ? lastUpdate.toLocaleTimeString()
                : ""}
            </p>
          )}
        </div>

        {/* Flight Details */}
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <h3 className="text-xl font-bold mb-4">Flight Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-300">Current Location</p>
                <p className="text-xl font-bold text-green-400">
                  {flightData.currentRegion}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-300">Altitude</p>
                <p className="text-2xl font-bold">
                  {flightData.altitude.toLocaleString()} ft
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-300">Ground Speed</p>
                <p className="text-2xl font-bold">{flightData.speed} mph</p>
              </div>
              {flightData.currentLat && (
                <div>
                  <p className="text-sm text-gray-300">Coordinates</p>
                  <p className="text-sm font-mono">
                    {typeof flightData.currentLat === "number"
                      ? flightData.currentLat.toFixed(4)
                      : "N/A"}
                    °N
                    <br />
                    {typeof flightData.currentLon === "number"
                      ? flightData.currentLon.toFixed(4)
                      : "N/A"}
                    °E
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <h3 className="text-xl font-bold mb-4">Route Information</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5" />
                <div>
                  <p className="font-semibold">Departure</p>
                  <p className="text-sm text-gray-300">{departureCity}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5" />
                <div>
                  <p className="font-semibold">Arrival</p>
                  <p className="text-sm text-gray-300">{arrivalCity}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-linear-to-br from-green-600 to-green-800 rounded-lg p-6 border border-green-400/50">
            <h3 className="text-xl font-bold mb-2">Welcome Home!</h3>
            <p className="text-green-100">
              The nation awaits the return of {passengerName}. Safe travels!
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 text-center text-sm text-gray-400">
        <p>
          Real-time flight tracking powered by OpenSky Network • Leader
          Homecoming 2025
        </p>
      </div>
    </div>
  );
};

export default LeaderHomecoming;
