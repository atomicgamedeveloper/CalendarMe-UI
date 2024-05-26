let fsp = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function createEvents(auth, eventBodiesArray) {
    const calendar = google.calendar({ version: 'v3', auth });

    for (let eventBody of eventBodiesArray) {
        try {
            const event = await calendar.events.insert({
                calendarId: 'primary',
                resource: eventBody,
            });
            console.log(`Event created: ${event.data.htmlLink}`);
        } catch (error) {
            console.error('Error creating event', error);
            // Optionally, continue to the next iteration instead of stopping the loop.
            // continue;
        }
    }
}

const colors = {
    1: ["#E6E6FA"], // lavender
    2: ["#BCB88A", "#B2AC88"], // sage
    3: ["#6F2DA8", "#6F2D91"], // grape
    4: ["#FC8EAC", "#FC74E7"], // flamingo
    5: ["#FFE135"], // banana
    6: ["#F28500", "#F08035", "#FFA500"], // tangerine
    7: ["#004B49", "#005377", "#004B77"], // peacock
    8: ["#636466", "#4B4E53", "#4B4B4B"], // graphite
    9: ["#0000FF", "#4F86F7", "#4B0082"], // blueberry
    10: ["#32612D", "#5CB85C", "#007320"], // basil
    11: ["#FF6347"] // tomato
};

function hexToRgb(hex) {
    let bigint = parseInt(hex.slice(1), 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    return [r, g, b];
}

function getClosestColor(hex) {
    let inputRgb = hexToRgb(hex);
    let closestColorNumber = '';
    let shortestDistance = Infinity;

    for (let colorNumber in colors) {
        for (let colorHex of colors[colorNumber]) {
            let colorRgb = hexToRgb(colorHex);
            let distance = Math.sqrt(
                Math.pow(inputRgb[0] - colorRgb[0], 2) +
                Math.pow(inputRgb[1] - colorRgb[1], 2) +
                Math.pow(inputRgb[2] - colorRgb[2], 2)
            );

            if (distance < shortestDistance) {
                shortestDistance = distance;
                closestColorNumber = colorNumber;
            }
        }
    }

    return closestColorNumber;
}

function createEventObjects(optionsArray) {
    let events = [];
    const currentDateTime = new Date();  // Get the current date and time

    function formatDateForAllDay(dateOrObject) {
        let dateString;

        if (dateOrObject && typeof dateOrObject === "object" && "date" in dateOrObject) {
            dateString = dateOrObject.date;
        } else if (typeof dateOrObject === "string") {
            dateString = dateOrObject;
        } else {
            console.error("Invalid input to formatDateForAllDay:", dateOrObject);
            return null;
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(dateString)) return dateString;

        const dateTimeParts = dateString.split('T');
        return dateTimeParts[0];
    }

    optionsArray.forEach(options => {
        let event = {
            'summary': options.summary,
            'description': options.description,
            'start': {},
            'end': {}
        };

        let eventStartDateTime, eventEndDateTime;

        if (options.allDay) {
            event.start.date = formatDateForAllDay(options.start);
            event.end.date = formatDateForAllDay(options.end);

            // For all-day events, set time to start of day for comparison:
            eventStartDateTime = new Date(event.start.date + "T00:00:00");
        } else {
            event.start["dateTime"] = options.start + "+02:00";
            event.end["dateTime"] = options.end + "+02:00";

            eventStartDateTime = new Date(options.start); // Use real date-time comparison
        }

        // Check if the current date-time is past the event start date-time:
        if (currentDateTime >= eventStartDateTime) {
            event.summary = "✅" + event.summary;
        }

        if (options.recurrence) {
            event.recurrence = options.recurrence;
        }

        if (options.location) {
            event.location = options.location;
        }

        if (options.reminders) {
            event.reminders = {
                'useDefault': false,
                'overrides': options.reminders
            };
        }

        if (options.color) {
            event.colorId = getClosestColor(options.color);
        }

        events.push(event);
    });

    console.log("The returned object:");
    console.log(events);
    return events;
}

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fsp.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    try {
        // Read the credentials file
        const content = await fsp.readFile(CREDENTIALS_PATH, 'utf8'); // Ensure encoding is specified to get a string
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;

        // Prepare the payload
        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
        });

        // Write the updated credentials
        await fsp.writeFile(TOKEN_PATH, payload);
        console.log("Credentials saved successfully.");
    } catch (error) {
        console.error("Failed to save credentials:", error);
    }
}

async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

module.exports = { createEvents, createEventObjects, authorize }