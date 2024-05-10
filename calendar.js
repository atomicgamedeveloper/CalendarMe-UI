let fsp = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

console.log("Hello World!");

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

function createEventObjects(optionsArray) {
    // Initialize an array to hold all event objects
    let events = [];

    console.log(optionsArray);

    // Iterate over each set of options
    optionsArray.forEach(options => {
        let event = {
            'summary': options.summary,
            'description': options.description,
            // Initialize start and end events without dateTime or date
            'start': {},
            'end': {}
        };

        // Check if it's an all day event
        if (options.allDay) {
            event.start.date = options.start;
            event.end.date = options.end;
        } else {
            event.start["dateTime"] = options.start + "+02:00";
            event.end["dateTime"] = options.end + "+02:00";
        }

        // Add recurrence if provided
        if (options.recurrence) {
            event.recurrence = options.recurrence;
        }

        // Add reminders if provided
        if (options.reminders) {
            event.reminders = {
                'useDefault': false,
                'overrides': options.reminders
            };
        }

        // Add the constructed event to the events array
        events.push(event);
    });
    console.log("The returned object:");
    console.log(events);
    return events; // Returns an array of event objects
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
/**
 * Load or request or authorization to call APIs.
 *
 */
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

/*
authorize().then(auth => {
    const newEvent = createEventObjects([{ "summary": "😴 Rest Time", "description": "I'm going to take some time off to lie down and recharge 🔋.", "start": "2024-05-09T22:15:00", "end": "2024-05-09T23:15:00" }])//[{ "summary": "😴 Rest Time", "description": "I'm going to take some time off to lie down and recharge 🔋.", "start": { "dateTime": "2024-05-09T22:15:00+01:00" }, "end": { "dateTime": "2024-05-09T23:15:00+01:00" } }];
    console.log([{ "summary": "😴 Rest Time", "description": "I'm going to take some time off to lie down and recharge 🔋.", "start": { "dateTime": "2024-05-09T22:15:00+01:00" }, "end": { "dateTime": "2024-05-09T23:15:00+01:00" } }]);
    console.log(newEvent);
    createEvents(auth, newEvent).catch(console.error);
}).catch(console.error);
/*
authorize().then(auth => {
    // Preparing the date format for an all-day event
    const startDate = new Date('2024-05-15').toISOString().substring(0, 10); // Converting to 'YYYY-MM-DD' format
    const endDate = new Date('2024-05-16').toISOString().substring(0, 10);  // All-day event end date should be the next day in 'YYYY-MM-DD' format

    // Creating an event object
    const newEvent = createEventObjects([{
        summary: 'Team Meeting - All Day', // Summary
        location: 'Online', // Location
        description: 'Discuss project progress', // Description
        start: startDate, // Start date for all-day event
        end: endDate, // End date for all-day event
        allDay: true, // Marking this event as an all-day event
        // Time zone is irrelevant for all-day events but set for consistency if needed
    }]);

    // Assuming createEvent is a function that creates an event on Google Calendar using the provided authentication and event object
    createEvents(auth, newEvent).catch(console.error);

}).catch(console.error);

*/

module.exports = { createEvents, createEventObjects, authorize }