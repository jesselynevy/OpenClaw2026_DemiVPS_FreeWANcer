import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({
  version: "v3",
  auth: oauth2Client,
});

export async function createCalendarEvent({
  title,
  description,
  start,
  end,
}) {
  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: title,
      description,
      start: {
        dateTime: start,
        timeZone: process.env.TIMEZONE,
      },
      end: {
        dateTime: end,
        timeZone: process.env.TIMEZONE,
      },
    },
  });

  return res.data;
}

export async function deleteCalendarEvent(eventId) {
  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    eventId,
  });
}
