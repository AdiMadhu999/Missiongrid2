import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { LeaveRequest } from '../models/leave';
import { StudentUpdatesService } from './studentUpdates';

// Helper to calculate end date from start date and number of days
const calculateEndDate = (startDateStr: string, numberOfDays: number): string => {
  try {
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + numberOfDays - 1);
    return end.toISOString().split('T')[0];
  } catch (err) {
    console.error('Error calculating end date:', err);
    return startDateStr;
  }
};

export const requestLeave = async (request: Omit<LeaveRequest, 'id' | 'status' | 'requestDate' | 'endDate'> & { uid?: string }) => {
  const endDate = calculateEndDate(request.startDate, request.numberOfDays);
  return await addDoc(collection(db, 'leaveRequests'), {
    ...request,
    endDate,
    uid: request.uid || '',
    status: 'pending',
    requestDate: new Date().toISOString()
  });
};

export const getLeaveRequests = async (): Promise<LeaveRequest[]> => {
  const snap = await getDocs(query(collection(db, 'leaveRequests'), orderBy('requestDate', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
};

export const getStudentLeaveRequests = async (studentId: string): Promise<LeaveRequest[]> => {
  const snap = await getDocs(
    query(
      collection(db, 'leaveRequests'),
      where('studentId', '==', studentId)
    )
  );
  const requests = snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
  return requests.sort((a, b) => new Date(b.requestDate || 0).getTime() - new Date(a.requestDate || 0).getTime());
};

// Real-time subscription for all leave requests (for Mentor)
export const subscribeLeaveRequests = (onUpdate: (requests: LeaveRequest[]) => void) => {
  const q = query(collection(db, 'leaveRequests'), orderBy('requestDate', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
    onUpdate(requests);
  }, (error) => {
    console.error('Error subscribing to leave requests:', error);
  });
};

// Real-time subscription for a student's leave requests (for Student)
export const subscribeStudentLeaveRequests = (studentId: string, onUpdate: (requests: LeaveRequest[]) => void) => {
  const q = query(
    collection(db, 'leaveRequests'),
    where('studentId', '==', studentId)
  );
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
    requests.sort((a, b) => new Date(b.requestDate || 0).getTime() - new Date(a.requestDate || 0).getTime());
    onUpdate(requests);
  }, (error) => {
    console.error('Error subscribing to student leave requests:', error);
  });
};

export const updateLeaveRequest = async (id: string, status: 'approved' | 'rejected' | 'cancelled') => {
  const docRef = doc(db, 'leaveRequests', id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const leave = snap.data() as LeaveRequest;
    await updateDoc(docRef, { status });
    try {
      let title = '🚨 Leave Update';
      let desc = `Your leave request status has been changed to ${status}.`;
      if (status === 'approved') {
        title = '🚨 Leave Approved';
        desc = `Your leave request for dates ${leave.startDate} to ${leave.endDate || ''} has been approved.`;
      } else if (status === 'rejected') {
        title = '🚨 Leave Rejected';
        desc = `Your leave request for dates ${leave.startDate} to ${leave.endDate || ''} has been rejected.`;
      } else if (status === 'cancelled') {
        title = '🚨 Leave Cancelled';
        desc = `Your leave request for dates ${leave.startDate} to ${leave.endDate || ''} has been cancelled by the mentor.`;
      }

      await StudentUpdatesService.createUpdate({
        studentId: leave.studentId,
        type: status === 'approved' ? 'leave_approved' : status === 'rejected' ? 'leave_rejected' : 'leave_cancelled',
        title,
        description: desc,
        remark: leave.reason
      });
    } catch (err) {
      console.error('Error logging leave request student update:', err);
    }
  } else {
    await updateDoc(docRef, { status });
  }
};
