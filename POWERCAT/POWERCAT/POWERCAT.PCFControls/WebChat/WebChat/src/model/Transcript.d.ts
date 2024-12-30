interface Transcript {
  activities?: Activity[];
}

export interface Activity {
  valueType?: string;
  type: string;
  timestamp: number;
  from: From;
  id?: string;
  channelId?: string;
  text?: string;
  attachments?: Attachment[];
  value?: Value;
  replyToId?: string;
}

interface From {
  id: string;
  role: number;
}

interface Value {
  isDesignMode?: boolean;
  locale?: string;
  intentTitle?: string;
  intentType?: number;
  triggerUtterance?: string;
  normalizedTriggerUtterance?: string;
  intentId?: string;
  intentScore?: IntentScore;
  startTimeUtc?: string;
  endTimeUtc?: string;
  type?: string;
  outcome?: string;
  turnCount?: number;
  lastTriggeredIntentId?: string;
  lastUserIntentId?: string;
  impliedSuccess?: boolean;
}

interface IntentScore {
  score: number;
  properties: IntentScoreProperties;
}

interface IntentScoreProperties {
  Type: number;
  Title: string;
}

interface Attachment {
  contentType: string;
  content: AdaptiveCardContent;
}

export interface AdaptiveCardContent {
  type: string;
  version: string;
  body: Body[];
}

interface Body {
  type: string;
  items?: Item[];
  color?: string;
  text?: string;
  wrap?: boolean;
  style?: string;
  id?: string;
  placeholder?: string;
  isMultiSelect?: boolean;
  choices?: Choice[];
  isRequired?: boolean;
  label?: string;
  errorMessage?: string;
  actions?: Action[];
}

interface Item {
  type: string;
  color?: string;
  text?: string;
  wrap?: boolean;
  style?: string;
}

interface Choice {
  title: string;
  value: string;
}

interface Action {
  type: string;
  data: Data;
  title: string;
}

interface Data {
  actionSubmitId: string;
}

export default Transcript;
