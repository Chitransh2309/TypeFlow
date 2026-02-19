# Typing Contest Rooms Feature

## Overview

The TypeFlow Rooms feature allows users to create and join multiplayer typing contest rooms where they can compete with others in real-time. The feature includes:

- **Public & Private Rooms**: Create public rooms visible to all or private rooms with password protection
- **Customizable Settings**: Configure difficulty, test mode (time/words), duration, and max participants
- **Real-time Progress Tracking**: Watch other users' typing speed (WPM), accuracy, and progress bars live
- **Live Leaderboard**: See final results and rankings after each contest
- **Room Management**: Join, create, leave rooms with full control

## Architecture

### Database Schema

#### `rooms` Collection
Stores room metadata and current state:
```typescript
{
  roomId: string,           // Unique room code (e.g., "ABC123")
  name: string,            // Room name
  host: {                  // Host information
    userId: string,
    userName: string,
    userImage?: string
  },
  isPublic: boolean,       // Public or private room
  passwordHash?: string,   // For private rooms
  settings: {              // Contest settings
    mode: "time" | "words",
    timeLimit?: number,    // seconds
    wordCount?: number,
    difficulty: "easy" | "normal" | "hard"
  },
  status: "waiting" | "active" | "finished",
  participants: [],        // Array of RoomParticipant
  maxParticipants: number,
  createdAt: Date,
  startedAt?: Date,
  endedAt?: Date,
  testText?: string        // Text all participants type
}
```

#### `room_results` Collection
Stores individual test results:
```typescript
{
  roomId: string,
  userId: string,
  userName: string,
  userImage?: string,
  wpm: number,
  accuracy: number,
  elapsedTime: number,
  position: number,        // Final ranking
  createdAt: Date
}
```

### API Routes

#### Room Management
- `GET /api/rooms` - List public waiting rooms
- `POST /api/rooms` - Create new room
- `GET /api/rooms/:roomId` - Get room details
- `POST /api/rooms/:roomId/join` - Join a room
- `POST /api/rooms/:roomId/leave` - Leave a room
- `DELETE /api/rooms/:roomId` - Delete room (host only)

#### Contest
- `POST /api/rooms/:roomId/start` - Start contest (host only)
- `POST /api/rooms/:roomId/submit-result` - Submit typing result
- `GET /api/rooms/:roomId/results` - Get leaderboard

### Socket.io Events

#### Server → Client
- `room:updated` - Room participants or status changed
- `room:started` - Contest has started, includes test text
- `user:joined` - New user joined the room
- `user:left` - User left the room
- `progress:update` - Live typing progress update
- `user:finished` - User finished typing
- `room:finished` - Contest ended

#### Client → Server
- `join:room` - Join a specific room
- `leave:room` - Leave room
- `progress:send` - Send typing progress updates
- `result:submit` - Submit final result
- `start:contest` - Start contest (host only)
- `end:contest` - End contest (host only)

## Components

### Pages
- `/rooms` - Room browser and creation
- `/rooms/[roomId]` - Active room (lobby, contest, or results)

### Components
- `CreateRoomDialog` - Form to create new room with settings
- `RoomBrowser` - List and search public rooms
- `RoomLobby` - Waiting room before contest starts
- `RoomContest` - Live typing interface with participant progress
- `RoomLeaderboard` - Final results and rankings
- `UserProgressCard` - Individual user progress display

## Features

### 1. Room Creation
Users can create rooms with:
- Custom room name
- Public or private (password-protected) option
- Test mode selection (time or word-based)
- Difficulty level (easy, normal, hard)
- Max participant limit (2-50)

### 2. Room Joining
- Browse public rooms with search/filter
- Join full rooms (if capacity available)
- Password entry for private rooms
- Real-time participant list

### 3. Lobby Phase
Before contest starts:
- View room settings and all participants
- Share room code with others
- Host can start contest when ready
- Minimum 2 participants required

### 4. Contest Phase
During active typing:
- Display test text with character highlighting
- Type in textarea with real-time metrics
- See all participants' live progress:
  - Current WPM
  - Accuracy percentage
  - Progress bar
- Cannot join once contest starts
- Submit result when typing complete

### 5. Results Phase
After contest ends:
- Rankings with medal indicators
- Detailed stats per user (WPM, accuracy, time)
- Your score highlighted
- Play again or leave option

## Security

- **Authentication**: All operations require NextAuth session
- **Authorization**: 
  - Only host can start/end contest and delete room
  - Cannot rejoin after leaving
  - Password hashing with bcryptjs for private rooms
- **Data Validation**: Input validation on all API routes
- **Row-Level Security**: (Ready for Supabase integration)

## Real-time Updates

Uses Socket.io for instant updates:
- All participants see same test text simultaneously
- WPM and accuracy calculated client-side, validated server-side
- Progress updates broadcast every keystroke
- Finished state immediately visible to all users

## Setup Instructions

### 1. Install Dependencies
Dependencies are already added to package.json:
```json
{
  "socket.io": "^4.7.2",
  "socket.io-client": "^4.7.2",
  "bcryptjs": "^2.4.3",
  "nanoid": "^5.0.4"
}
```

### 2. Environment Variables
Add to `.env.local`:
```
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=your-mongodb-connection-string
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup
MongoDB collections will be created automatically when accessed:
- `rooms` - Room data
- `room_results` - Contest results

### 4. Running Locally
```bash
npm install
npm run dev
```

Then navigate to `/rooms` to start creating and joining rooms.

## Usage Flow

### Creating a Room
1. Navigate to `/rooms`
2. Click "Create Room" button
3. Fill in room details (name, privacy, settings)
4. Submit - you'll be taken to the room lobby

### Joining a Room
1. Browse public rooms on `/rooms` page
2. Click "Join Room" on desired room card
3. Enter password if private room
4. Enter the lobby

### Starting Contest
1. As host, click "Start Contest" in lobby (min 2 participants)
2. All participants see test text and start typing area
3. Progress updates broadcast in real-time
4. Complete typing and submit result

### Viewing Results
1. After host ends contest or all finish
2. Leaderboard shows automatically
3. View rankings, WPM, accuracy
4. Can play again or leave room

## Future Enhancements

- [ ] User profile integration with stats
- [ ] Matchmaking for similar skill levels
- [ ] Room templates and presets
- [ ] Chat during contest
- [ ] Replay/recording of contests
- [ ] Friends-only rooms
- [ ] Seasonal leaderboards
- [ ] Badges/achievements
- [ ] Custom word lists
- [ ] Challenge invitations

## Troubleshooting

### Socket.io Connection Issues
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly
- Check browser console for connection errors
- Verify websocket support in your hosting environment

### Room Not Found
- Room may have been deleted if it became empty
- Try creating a new room instead

### Cannot Join Full Room
- Room has reached max participant limit
- Create your own room or wait for space

### Results Not Showing
- Wait a moment for all submissions to process
- Refresh the page if stuck

## Testing

Test the feature locally:
```bash
npm run dev
# Open http://localhost:3000/rooms
```

Create multiple browser windows to test:
1. Create room in window 1
2. Join with window 2 (different user account)
3. Start contest in window 1
4. Type in both windows
5. Watch real-time progress sync
6. View results

## File Structure

```
app/
  api/
    rooms/
      route.ts                    # Create & list rooms
      [roomId]/
        route.ts                  # Get room details
        join/route.ts            # Join room
        leave/route.ts           # Leave room
        start/route.ts           # Start contest
        submit-result/route.ts   # Submit typing result
        results/route.ts         # Get leaderboard
        delete/route.ts          # Delete room
  rooms/
    page.tsx                      # Room browser page
    [roomId]/
      page.tsx                    # Active room page

components/
  rooms/
    create-room-dialog.tsx       # Create room form
    room-browser.tsx             # Browse & join rooms
    room-lobby.tsx               # Waiting room
    room-contest.tsx             # Live typing interface
    room-leaderboard.tsx         # Results display
    user-progress-card.tsx       # Progress indicator
    index.ts                      # Export all

hooks/
  use-socket-room.ts             # Socket.io integration hook

lib/
  models/room.ts                 # TypeScript interfaces
  rooms.ts                        # Room database operations
  socket-handler.ts              # Socket.io server handlers
  socket-server.ts               # Socket.io initialization
```

## License

Part of TypeFlow typing speed application.
