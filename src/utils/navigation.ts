export const getNavigationPath = (activityType: string, activityId: string) => {
    switch(activityType) {
        case 'DailyTest':
            return `/app/tests/attempt/${activityId}`;
        case 'Solved':
            return `/app/doubt?id=${activityId}`;
        case 'Reply':
            return `/app/feed?id=${activityId}`;
        case 'Telegram':
             return `/app/chat/${activityId}`;
        case 'PrivateDoubtInvitation':
            return `/app/doubt?id=${activityId}`;
        case 'PublicDoubtCreated':
            return `/app/doubt?id=${activityId}`;
        case 'MentorPostCreated':
            return `/app/feed?id=${activityId}`;
        default:
            return '/app/feed';
    }
}
