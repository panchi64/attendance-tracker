function NewsandComments() {
    return(
        <div class="w-full h-full grid-rows-8 text-black m-8">
            <div class="row-span-1 row-start-1 text-3xl m-2">
                News / Comments
                <div class="divider my-2"></div>
            </div>
            <textarea class="textarea-block bg-transparent px-4 pt-1 pb-4 w-full border-0" placeholder="Today's notes..."></textarea>
        </div>
    );
}

export default NewsandComments;