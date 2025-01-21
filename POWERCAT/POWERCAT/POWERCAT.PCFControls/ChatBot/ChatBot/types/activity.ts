export interface IEntity {
  "@context": string;
  "@id": string;
  "@type": string;
  keywords: string[];
  type: string;
  author: {
    "@context": string;
    "@type": string;
    image: string;
    name: string;
  };
}

export interface IFrom {
  role: "user" | "bot";
}

export interface IActivity {
  timestamp: string;
  from: IFrom;
  id: string;
  text?: string;
  type: string;
  entities?: IEntity[];
  textFormat?: string;
  attachments?: {
    contentType: string;
    contentUrl?: string;
    content?: any;
    name?: string;
  }[];
  suggestedActions?: {
    actions: {
      type: string;
      title: string;
      value: string;
    }[];
  };
}
