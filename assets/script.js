// Global variables
let map = null;
let marker = null;
let latitude = null;
let longitude = null;
let isMapLoading = false;

// Initialize OpenStreetMap
function initOSM() {
	if (!latitude || !longitude) return;

	try {
		const mapElement = document.getElementById("map");
		// Fully reset the container
		mapElement.innerHTML = "";
		mapElement.className = "";
		mapElement.removeAttribute("style");
		mapElement.removeAttribute("tabindex");
		mapElement.removeAttribute("role");
		// Replace with a fresh clone to ensure no residual state
		const newMapElement = mapElement.cloneNode(false);
		mapElement.parentNode.replaceChild(newMapElement, mapElement);

		// Reassign mapElement after cloning
		const freshMapElement = document.getElementById("map");
		map = L.map(freshMapElement, {
			zoomControl: true,
			attributionControl: true
		}).setView([latitude, longitude], 16);

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
			tileSize: 256,
            zoomOffset: 0,
            detectRetina: true
		}).addTo(map);

		marker = L.marker([latitude, longitude], {
			title: "Image Location"
		}).addTo(map);
	} catch (e) {
		console.error("Error initializing OpenStreetMap:", e);
		document.getElementById("map").innerHTML = `
                    <div class="no-location">
                        <p>Error loading OpenStreetMap. Please try again.</p>
                    </div>
                `;
	}
}

// Clear existing map
function clearMap() {
	try {
		if (map) {
			map.off();
			map.remove();
			map = null;
		}
		marker = null;
		const mapElement = document.getElementById("map");
		if (mapElement) {
			mapElement.innerHTML = "";
			mapElement.className = "";
			mapElement.removeAttribute("style");
			mapElement.removeAttribute("tabindex");
			mapElement.removeAttribute("role");
			// Replace with a fresh clone to ensure no residual state
			const newMapElement = mapElement.cloneNode(false);
			mapElement.parentNode.replaceChild(newMapElement, mapElement);
		}
	} catch (e) {
		console.error("Error clearing map:", e);
	}
}

// Show map with loading state
function showMap() {
	if (isMapLoading) return;
	isMapLoading = true;
	const mapElement = document.getElementById("map");
	mapElement.classList.add("map-loading");

	if (!latitude || !longitude) {
		mapElement.innerHTML = `
                    <div class="no-location">
                        <i class="fas fa-map-marker-slash" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                        <p>No location data available for this image</p>
                    </div>
                `;
		document.getElementById("mapContainer").classList.remove("hidden");
		isMapLoading = false;
		mapElement.classList.remove("map-loading");
		return;
	}

	clearMap();
	document.getElementById("mapContainer").classList.remove("hidden");

	try {
		initOSM();
	} catch (e) {
		console.error("Map initialization failed:", e);
		mapElement.innerHTML = `
                    <div class="no-location">
                        <p>Error loading map. Please try again.</p>
                    </div>
                `;
	} finally {
		isMapLoading = false;
		mapElement.classList.remove("map-loading");
	}
}

// Utility functions for metadata extraction
function convertDMSToDD(degrees, minutes, seconds, direction) {
	let dd = degrees + minutes / 60 + seconds / 3600;
	if (direction === "S" || direction === "W") {
		dd = dd * -1;
	}
	return dd;
}

function getGPSData(exifData) {
	if (!exifData.GPSLatitude || !exifData.GPSLongitude) {
		return null;
	}

	try {
		const latDegrees =
			exifData.GPSLatitude[0].numerator / exifData.GPSLatitude[0].denominator;
		const latMinutes =
			exifData.GPSLatitude[1].numerator / exifData.GPSLatitude[1].denominator;
		const latSeconds =
			exifData.GPSLatitude[2].numerator / exifData.GPSLatitude[2].denominator;
		const latDirection = exifData.GPSLatitudeRef;

		const longDegrees =
			exifData.GPSLongitude[0].numerator / exifData.GPSLongitude[0].denominator;
		const longMinutes =
			exifData.GPSLongitude[1].numerator / exifData.GPSLongitude[1].denominator;
		const longSeconds =
			exifData.GPSLongitude[2].numerator / exifData.GPSLongitude[2].denominator;
		const longDirection = exifData.GPSLongitudeRef;

		latitude = convertDMSToDD(latDegrees, latMinutes, latSeconds, latDirection);
		longitude = convertDMSToDD(
			longDegrees,
			longMinutes,
			longSeconds,
			longDirection
		);

		return {
			latitude: latitude,
			longitude: longitude,
			formatted: `${latDegrees}° ${latMinutes}' ${latSeconds}" ${latDirection}, ${longDegrees}° ${longMinutes}' ${longSeconds}" ${longDirection}`
		};
	} catch (e) {
		console.error("Error extracting GPS data:", e);
		return null;
	}
}

// Group metadata into meaningful categories
function groupMetadata(exifData) {
	const groups = {
		"Camera Information": {},
		"Exposure Settings": {},
		"Lens Information": {},
		"Image Details": {},
		"Date and Time": {},
		"GPS Information": {},
		"Software Information": {},
		"Other Metadata": {}
	};

	Object.keys(exifData).forEach((key) => {
		const value = exifData[key];

		if (key === "thumbnail" || key === "MakerNote" || key === "UserComment") {
			return;
		}

		const formattedKey = key.replace(/([A-Z])/g, " $1").trim();

		if (["Make", "Model", "CameraOwnerName"].includes(key)) {
			groups["Camera Information"][formattedKey] = value;
		} else if (
			[
				"ExposureTime",
				"FNumber",
				"ISOSpeedRatings",
				"ExposureProgram",
				"ExposureMode",
				"ExposureCompensation",
				"MeteringMode",
				"Flash"
			].includes(key)
		) {
			groups["Exposure Settings"][formattedKey] = value;
		} else if (
			[
				"FocalLength",
				"FocalLengthIn35mmFilm",
				"LensModel",
				"LensMake",
				"LensSpecification"
			].includes(key)
		) {
			groups["Lens Information"][formattedKey] = value;
		} else if (
			[
				"PixelXDimension",
				"PixelYDimension",
				"XResolution",
				"YResolution",
				"Orientation",
				"ColorSpace",
				"BitsPerSample",
				"Compression"
			].includes(key)
		) {
			groups["Image Details"][formattedKey] = value;
		} else if (
			key.includes("Date") ||
			key.includes("Time") ||
			key.includes("Offset")
		) {
			groups["Date and Time"][formattedKey] = value;
		} else if (key.includes("GPS") || key === "latitude" || key === "longitude") {
			groups["GPS Information"][formattedKey] = value;
		} else if (["Software", "ProcessingSoftware", "HostComputer"].includes(key)) {
			groups["Software Information"][formattedKey] = value;
		} else {
			groups["Other Metadata"][formattedKey] = value;
		}
	});

	return groups;
}

// Format metadata values for display
function formatMetadataValue(key, value) {
	if (key === "ExposureTime") {
		if (value.numerator && value.denominator) {
			if (value.numerator === 1) {
				return `1/${value.denominator} sec`;
			} else {
				return `${value.numerator}/${value.denominator} sec`;
			}
		}
	}

	if (key === "FNumber") {
		if (value.numerator && value.denominator) {
			const fValue = value.numerator / value.denominator;
			return `f/${fValue.toFixed(1)}`;
		}
	}

	if (key === "FocalLength") {
		if (value.numerator && value.denominator) {
			const focalLength = value.numerator / value.denominator;
			return `${focalLength.toFixed(0)}mm`;
		}
	}

	if (Array.isArray(value)) {
		return value.join(", ");
	} else if (typeof value === "object" && value !== null) {
		if (value.numerator !== undefined && value.denominator !== undefined) {
			return (value.numerator / value.denominator).toFixed(2);
		} else {
			return JSON.stringify(value);
		}
	}

	return value;
}

// Display metadata in the UI
function displayMetadata(exifData, fileInfo) {
	document.getElementById("metadataLoader").classList.add("hidden");
	document.getElementById("metadataContainer").classList.remove("hidden");

	const combinedData = { ...exifData, ...fileInfo };
	const basicInfoContainer = document.getElementById("basicInfo");
	basicInfoContainer.innerHTML = "";

	const basicInfoKeys = [
		{ key: "fileName", label: "File Name" },
		{ key: "fileSize", label: "File Size" },
		{ key: "fileType", label: "File Type" },
		{ key: "Make", label: "Camera Make" },
		{ key: "Model", label: "Camera Model" },
		{ key: "DateTimeOriginal", label: "Date Taken" }
	];

	basicInfoKeys.forEach((item) => {
		if (combinedData[item.key]) {
			const infoItem = document.createElement("div");
			infoItem.className = "info-item";
			infoItem.innerHTML = `
                        <span class="label">${item.label}</span>
                        <span class="value">${formatMetadataValue(
																									item.key,
																									combinedData[item.key]
																								)}</span>
                    `;
			basicInfoContainer.appendChild(infoItem);
		}
	});

	const groupedData = groupMetadata(combinedData);
	const infoSection = document.getElementById("infoSection");
	infoSection.innerHTML = "";

	Object.keys(groupedData).forEach((groupName) => {
		const groupData = groupedData[groupName];
		const dataEntries = Object.entries(groupData);

		if (dataEntries.length === 0) return;

		const button = document.createElement("button");
		button.className = "collapsible";
		button.textContent = `${groupName} (${dataEntries.length})`;
		infoSection.appendChild(button);

		const contentDiv = document.createElement("div");
		contentDiv.className = "collapsible-content";

		const table = document.createElement("table");
		table.className = "metadata-table";

		dataEntries.forEach(([key, value]) => {
			const formattedValue = formatMetadataValue(key, value);

			const row = document.createElement("tr");
			row.innerHTML = `
                        <td>${key}</td>
                        <td>${formattedValue}</td>
                    `;
			table.appendChild(row);
		});

		contentDiv.appendChild(table);
		infoSection.appendChild(contentDiv);

		if (Object.keys(groupedData).indexOf(groupName) === 0) {
			button.classList.add("active");
			contentDiv.style.maxHeight = contentDiv.scrollHeight + "px";
		}
	});

	const collapsibles = document.querySelectorAll(".collapsible");
	collapsibles.forEach((coll) => {
		if (!coll.hasEventListener) {
			coll.hasEventListener = true;
			coll.addEventListener("click", function () {
				this.classList.toggle("active");
				const content = this.nextElementSibling;
				if (content.style.maxHeight) {
					content.style.maxHeight = null;
				} else {
					content.style.maxHeight = content.scrollHeight + "px";
				}
			});
		}
	});

	showMap();
}

// Process the uploaded image
function processImage(file) {
	const reader = new FileReader();
	latitude = null;
	longitude = null;

	const fileInfo = {
		fileName: file.name,
		fileSize: formatFileSize(file.size),
		fileType: file.type,
		lastModified: new Date(file.lastModified).toLocaleString()
	};

	reader.onload = function (e) {
		document.getElementById("imagePreview").src = e.target.result;

		EXIF.getData(file, function () {
			const exifData = EXIF.getAllTags(this);
			const gpsData = getGPSData(exifData);
			if (gpsData) {
				exifData.GPSCoordinates = gpsData.formatted;
			}
			displayMetadata(exifData, fileInfo);
		});
	};

	reader.readAsDataURL(file);
}

// Format file size to readable format
function formatFileSize(bytes) {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
	const dropzone = document.getElementById("dropzone");
	const fileInput = document.getElementById("fileInput");
	const selectFileBtn = document.getElementById("selectFileBtn");

	selectFileBtn.addEventListener("click", function () {
		fileInput.click();
	});
    dropzone.addEventListener("click", function() {
        fileInput.click();
    });

	fileInput.addEventListener("change", function (e) {
		if (e.target.files && e.target.files[0]) {
			processImage(e.target.files[0]);
		}
	});

	dropzone.addEventListener("dragover", function (e) {
		e.preventDefault();
		this.classList.add("dragover");
	});

	dropzone.addEventListener("dragleave", function () {
		this.classList.remove("dragover");
	});

	dropzone.addEventListener("drop", function (e) {
		e.preventDefault();
		this.classList.remove("dragover");

		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			processImage(e.dataTransfer.files[0]);
		}
	});
});
