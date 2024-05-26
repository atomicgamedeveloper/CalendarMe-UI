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

function getColorId(colorName) {
    const colorMap = {
        'lightpurple': 1, 'lavender': 1, 'lilac': 1, 'violet': 1,
        'lime': 2, 'sage': 2, 'lightgreen': 2, 'mint': 2,
        'darkpurple': 3, 'grape': 3, 'purple': 3, 'plum': 3,
        'salmon': 4, 'flamingo': 4, 'pink': 4, 'rose': 4,
        'gold': 5, 'banana': 5, 'yellow': 5, 'lemon': 5,
        'tangerine': 6, 'orange': 6, 'peach': 6,
        'lightblue': 7, 'peacock': 7, 'teal': 7, 'aqua': 7,
        'black': 8, 'graphite': 8, 'gray': 8, 'charcoal': 8,
        'darkblue': 9, 'blueberry': 9, 'blue': 9, 'navy': 9,
        'darkgreen': 10, 'basil': 10, 'green': 10, 'emerald': 10,
        'tomato': 11, 'red': 11, 'crimson': 11
    };

    return colorMap[colorName.toLowerCase()] || null;
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

        if (options.colour) {
            event.colorId = getColorId(options.colour);
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