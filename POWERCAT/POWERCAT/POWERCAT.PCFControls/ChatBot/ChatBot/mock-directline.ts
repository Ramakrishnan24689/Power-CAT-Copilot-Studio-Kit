import { BehaviorSubject, Observable } from "rxjs";
import { filter } from "rxjs/operators";
import { ConnectionState } from "./constants/connectionStates";
import { IActivity } from "./types/activity";

/**
 * Creates a mock DirectLine client that simulates the behavior of the actual DirectLine service
 * with proper connection state management and activity handling.
 *
 * Features:
 * - Maintains connection state through BehaviorSubject
 * - Simulates activity sending/receiving
 * - Handles error scenarios
 *
 * @param {Array} activities - Initial activities to display in the chat
 */
export class MockDirectLine {
  private activitySubject: BehaviorSubject<IActivity | null>;
  private statusSubject: BehaviorSubject<ConnectionState>;
  private currentActivities: IActivity[];
  public activity$: Observable<IActivity>;
  public connectionStatus$: Observable<ConnectionState>;

  constructor(activities: IActivity[] = []) {
    this.activitySubject = new BehaviorSubject<IActivity | null>(null);
    this.statusSubject = new BehaviorSubject<ConnectionState>(
      ConnectionState.Connected
    );

    // Share both streams
    this.connectionStatus$ = this.statusSubject.asObservable();
    this.activity$ = this.activitySubject
      .asObservable()
      .pipe(filter((activity): activity is IActivity => activity !== null)); // Filter out initial null value

    // Store the activities for reset functionality
    this.currentActivities = Array.isArray(activities) ? activities : [];

    // Initialize the conversation
    this.resetConversation();
  }

  public resetConversation(): void {
    // Clear existing messages
    this.activitySubject.next(null);

    // Re-send the initial activities with delays
    this.currentActivities.forEach((activity, index) => {
      setTimeout(() => this.activitySubject.next(activity), index * 1000);
    });
  }

  public postActivity(activity: IActivity): Observable<string> {
    const id = Math.random().toString(36).substr(2, 9);
    activity.id = id;

    this.activitySubject.next(activity);

    // Simulate bot response with the next available message from current transcript
    setTimeout(() => {
      const nextBotMessage = this.currentActivities.find(
        (a) => a.from.role === "bot" && a.id > activity.id
      );
      if (nextBotMessage) {
        this.activitySubject.next({
          ...nextBotMessage,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
        });
      }
    }, 1000);

    return new Observable((observer) => {
      observer.next(id);
      observer.complete();
    });
  }

  public simulateConnectionState(state: ConnectionState): void {
    this.statusSubject.next(state);
  }
}
