/**
 * Author: Jesse Atkinson
 */

let map;
let infoWindow;
let userMarker; // Marker for user location
const markers = []; // Ensure markers array is in the global scope
let directionsService;
let directionsRenderer;

const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

/**
 * Initializes the Google Map and sets up the necessary components, including the info window and directions services. 
 * Fetches GeoJSON data to add markers to the map.
 */
async function initMap() {
    const { Map } = await google.maps.importLibrary("maps");

    map = new Map(document.getElementById("map"), {
        center: { lat: 43.2557, lng: -79.8711 },
        zoom: 12,
        mapId: 'DEMO_MAP_ID',  // Replace with your actual Map ID
    });

    infoWindow = new google.maps.InfoWindow(); // Initialize the info window

    // Initialize Directions Service and Renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map); // Set the map for the directions renderer


    // Fetch GeoJSON data and add markers
    fetchGeoJsonData();
}

/**
 * Fetches GeoJSON data from a specified URL and adds markers to the map for the first 30 locations retrieved.
 * Populates a dropdown list with the names and addresses of these locations.
 */
async function fetchGeoJsonData() {
    const url = 'https://services.arcgis.com/rYz782eMbySr2srL/arcgis/rest/services/Bike_Parking/FeatureServer/8/query?outFields=*&where=1%3D1&f=geojson';

    try {
        const response = await fetch(url);
        const data = await response.json();
        const locations = data.features.slice(0, 30);  // Extract 30 locations from the GeoJSON

        locations.forEach((location, index) => {
            const [lng, lat] = location.geometry.coordinates;
            const properties = location.properties;
            const marker = addMarker(lat, lng, properties);
    
            // Add the marker to the dropdown list directly using markers array
            const option = document.createElement('option');
            option.value = markers.length - 1; // Use the index of the markers array
            option.text = properties.LOCATION_NAME + " - " + (properties.ADDRESS || "Information Unavailable");
            document.getElementById('destinationDropdown').appendChild(option);
        });

    } catch (error) {
        console.error('Error fetching GeoJSON data:', error);
    }
}
/**
 * Adds a marker to the map at the specified latitude and longitude with associated properties. 
 */
function addMarker(lat, lng, properties) {
    const position = { lat, lng }; // Store the position
    const marker = new AdvancedMarkerElement({
        position: position,
        map: map,
    });

    // Store marker properties
    marker.properties = properties;
    markers.push(marker); // Store marker in the markers array

    // Add click event listener to open info window
    marker.addListener("click", () => {
        const locationName = properties.LOCATION_NAME || "Information Unavailable";
        const address = properties.ADDRESS || "Information Unavailable";
        const rackOwner = properties.RACK_OWNER || "Information Unavailable";
        const totalCapacity = properties.TOTAL_CAPACITY || "Information Unavailable";
        const covered = properties.COVERED || "Information unavailable"; 
        const rackType = properties.RACK_TYPE || "Information Unavailable";
        const nearbyLighting = properties.NEARBY_LIGHTING || "Information unavailable";
        const content = `<div>
                          <h3>${locationName}</h3>
                          <p><strong>Address:</strong> ${address}</p>
                          <p><strong>Rack Owner:</strong> ${rackOwner}</p>
                          <p><strong>Rack Type:</strong> ${rackType}</p>
                          <p><strong>Total Capacity:</strong> ${totalCapacity}</p>
                          <p><strong>Covered:</strong> ${covered}</p>
                          <p><strong>Nearby Lighting:</strong> ${nearbyLighting}</p>
                        </div>`;
        infoWindow.setContent(content);
        infoWindow.setPosition(position); // Use the stored position
        infoWindow.open(map); // Open info window
    });
    return marker;
}
/**
 * Locates the user's current geographic position using the Geolocation API.
 * If the location is successfully obtained, it creates a marker on the map to represent the user's position and centers the map on this location.
 */
function locateUser() {
    // Check if the browser supports geolocation
    if (navigator.geolocation) {
        // Get the user's current position
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Create an object with the user's latitude and longitude
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                // Remove previous user marker if it exists
                if (userMarker) {
                    userMarker.setMap(null);
                }

                // Create a new user marker with a custom icon
                userMarker = new google.maps.Marker({
                    position: userLocation,
                    map: map,
                    icon: {
                        url: "user_marker.png", 
                        scaledSize: new google.maps.Size(30, 30),
                    },
                });

                // Center the map on the user's location
                map.setCenter(userLocation);
            },
            () => {
                // Handle location error if permission is denied or location retrieval fails
                handleLocationError(true, infoWindow, map.getCenter());
            }
        );
    } else {
        // Handle case where the browser doesn't support Geolocation
        handleLocationError(false, infoWindow, map.getCenter());
    }
}
/**
 * Adds a marker on the map for a specified address using the Google Maps Geocoding API.
 * Geocodes the provided address, retrieves its geographical location, and places a marker at that location on the map. 
 */
async function addMarkerForAddress(address) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, (results, status) => {
        if (status === "OK") {
            const location = results[0].geometry.location;

            // Remove previous user marker if it exists
            if (userMarker) {
                userMarker.setMap(null);
            }

            // Create a new marker for the entered address
            userMarker = new google.maps.Marker({
                position: location,
                map: map,
                icon: {
                    url: "user_marker.png", // Use your local icon file here
                    scaledSize: new google.maps.Size(30, 30), // Adjust size if needed
                },
            });

            // Center the map on the new marker's location
            map.setCenter(location);
        } else {
            console.error("Geocode was not successful for the following reason: " + status);
        }
    });
}
/**
 * Retrieves and displays directions from the user's current location to a selected destination from the dropdown menu. 
 * Checks if both the user's location and the destination marker are set on the map. 
 * If valid locations are provided, it requests directions from the Google Maps Directions Service and renders the route on the map.
 */
function getDirections() {
    const dropdown = document.getElementById('destinationDropdown');
    const selectedIndex = parseInt(dropdown.value, 10); 
    const destinationMarker = markers[selectedIndex];  // Reference from markers array

    // Ensure user has origin destionation on the map and has selected a destination from dropdown
    if (!userMarker || !destinationMarker) {
        alert('Please make sure both origin and destination are set.');
        return;
    }

    const userLocation = userMarker.position;
    const destinationLocation = destinationMarker.position;

    const request = {
        origin: userLocation,
        destination: destinationLocation,
        travelMode: google.maps.TravelMode.WALKING,
    };
    // Request directions from the directions service and place the route on the map
    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            console.error('Directions request failed due to ' + status);
        }
    });
}

// Event listener for address input field when field loses focus
document.getElementById("addressInput").addEventListener("blur", function(event) {
    const address = event.target.value;
    if (address) {
        addMarkerForAddress(address); // Add marker when input loses focus
    }
});
// Event listener for address input field when enter is pressed
document.getElementById("addressInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        const address = event.target.value;
        if (address) {
            addMarkerForAddress(address); // Add marker when Enter is pressed
        }
    }
});
// Event listener for 'nearby lighting' button to hide all locations that do not have nearby lighting
document.getElementById("nearbyLighting").addEventListener("click", function() {
    markers.forEach(marker => {
        if (marker.properties && marker.properties.NEARBY_LIGHTING === "Yes") {
            marker.setMap(map); // Show Nearby lighting
        } else {
            marker.setMap(null); // Hide all other markers
        }
    });
});
// Event listener for 'show all' button to show all markers for all locations
document.getElementById("showAll").addEventListener("click", function() {
    console.log("Show All button clicked");
    
    markers.forEach(marker => {
        marker.setMap(map); // Show all markers
    });
});
// Event listener for 'locate me' button
document.getElementById("locateMe").addEventListener("click", locateUser);
// Event listener for 'get directions' button
document.getElementById("getDirections").addEventListener("click", getDirections);

// Initialize the map
initMap();
