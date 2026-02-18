document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const fileTableBody = document.getElementById('fileTableBody');
    const noFilesMessage = document.getElementById('no-files-message');
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = document.getElementById('progressBar');
    const toastContainer = document.getElementById('toastContainer');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const modalActions = document.getElementById('modalActions');

    const API_URL = 'http://localhost:3000'; 

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    

    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };
    
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    };
    
    const hideModal = () => modalOverlay.style.display = 'none';
    
    
    const showDeleteModal = (filename) => {
        modalTitle.textContent = 'Confirm Deletion';
        modalContent.innerHTML = `<p>Are you sure you want to delete <strong>${filename}</strong>? This action cannot be undone.</p>`;
        modalActions.innerHTML = `
            <button class="btn-secondary" id="cancelDeleteBtn">Cancel</button>
            <button class="btn-danger" id="confirmDeleteBtn">Delete</button>
        `;
        modalOverlay.style.display = 'flex';
        
        document.getElementById('cancelDeleteBtn').onclick = hideModal;
        document.getElementById('confirmDeleteBtn').onclick = () => {
            deleteFile(filename);
            hideModal();
        };
    };

    const showRenameModal = (oldName) => {
        modalTitle.textContent = 'Rename File';
        modalContent.innerHTML = `<input type="text" id="newFileNameInput" value="${oldName}" required>`;
        modalActions.innerHTML = `
            <button class="btn-secondary" id="cancelRenameBtn">Cancel</button>
            <button class="btn-primary" id="confirmRenameBtn">Rename</button>
        `;
        modalOverlay.style.display = 'flex';
        
        const newNameInput = document.getElementById('newFileNameInput');
        newNameInput.focus();
        newNameInput.setSelectionRange(0, oldName.lastIndexOf('.') > 0 ? oldName.lastIndexOf('.') : oldName.length);

        document.getElementById('cancelRenameBtn').onclick = hideModal;
        document.getElementById('confirmRenameBtn').onclick = () => {
            const newName = newNameInput.value.trim();
            if (newName && newName !== oldName) {
                renameFile(oldName, newName);
                hideModal();
            } else if (!newName) {
                showToast('New name cannot be empty.', 'error');
            } else {
                hideModal();
            }
        };
    };

    const fetchFiles = async () => {
        try {
            const response = await fetch(`${API_URL}/files`);
            if (!response.ok) throw new Error('Failed to fetch files.');
            const files = await response.json();
            
            fileTableBody.innerHTML = '';
            
            if (files.length === 0) {
                noFilesMessage.style.display = 'block';
                document.querySelector('.file-table thead').style.display = 'none';
            } else {
                noFilesMessage.style.display = 'none';
                document.querySelector('.file-table thead').style.display = '';

                files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

                files.forEach(file => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td data-label="Name">${file.name}</td>
                        <td data-label="Size">${formatFileSize(file.size)}</td>
                        <td data-label="Last Modified">${formatDate(file.lastModified)}</td>
                        <td data-label="Actions" class="actions">
                            <a href="${API_URL}/download/${file.name}" class="action-btn download" title="Download">&#x21E9;</a>
                            <button class="action-btn rename" title="Rename" data-filename="${file.name}">&#x270E;</button>
                            <button class="action-btn delete" title="Delete" data-filename="${file.name}">&#x1F5D1;</button>
                        </td>
                    `;
                    fileTableBody.appendChild(tr);
                });
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            showToast('Could not load files.', 'error');
        }
    };

    const uploadFile = (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/upload`, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                progressContainer.style.display = 'block';
                progressBar.style.width = percentComplete + '%';
            }
        };

        xhr.onload = () => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            try {
                const response = JSON.parse(xhr.responseText);
                showToast(response.message || 'File action complete', xhr.status >= 200 && xhr.status < 300 ? 'success' : 'error');
                if (xhr.status >= 200 && xhr.status < 300) fetchFiles();
            } catch (error) {
                 showToast('An unknown error occurred.', 'error');
            }
            uploadForm.reset();
        };

        xhr.onerror = () => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            showToast('Upload failed due to a network error.', 'error');
            uploadForm.reset();
        };

        xhr.send(formData);
    };

    const deleteFile = async (filename) => {
        try {
            const response = await fetch(`${API_URL}/files/${filename}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Deletion failed.');
            showToast(result.message, 'success');
            fetchFiles();
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const renameFile = async (oldName, newName) => {
        try {
            const response = await fetch(`${API_URL}/files/${oldName}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Rename failed.');
            showToast(result.message, 'success');
            fetchFiles();
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    uploadForm.addEventListener('submit', uploadFile);

    fileTableBody.addEventListener('click', (e) => {
        const target = e.target.closest('button.action-btn');
        if (!target) return;
        const filename = target.dataset.filename;
        if (target.classList.contains('rename')) showRenameModal(filename);
        if (target.classList.contains('delete')) showDeleteModal(filename);
    });

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });

    fetchFiles();
});